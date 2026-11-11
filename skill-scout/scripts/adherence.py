#!/usr/bin/env python3
"""Skill read rates from this machine's T3 Code database, one row per skill.

usage: adherence.py [--since 7d] [--all]

For each skill: of the threads that changed files in the window, how many read
the skill at any point. Columns split threads by who started them: Peter
(top-level threads he created), agent-started (top-level threads a schedule
or another agent created) and subagents (any thread with a parent). orchestrate counts
only threads that linked two or more pull requests, the multi-PR work it owns.

A thread read a skill when a shell command prints `<skill>/SKILL.md` (cat,
sed -n, head, tail, nl, bat, less or more on it), a Read tool call opens it, or
a Skill tool call loads it, plugin prefix allowed. Searching, counting, editing
or naming the path in a brief or prompt does not count. Deleted threads count,
so scheduled runs that were cleaned up still show.

Prints a markdown table. The database is $T3CODE_HOME/userdata/statev2.sqlite
(default ~/.t3), opened read-only. Exit 3 means the database layout was not
recognised.
"""

import argparse
import os
import pathlib
import re
import sqlite3
import sys
import datetime as dt

USERDATA = pathlib.Path(os.environ.get("T3CODE_HOME", "~/.t3")).expanduser() / "userdata"

# skill, threads it is measured on, extra thread filter
SKILLS = [
    ("finish-task", "editing threads", ""),
    ("orchestrate", "editing threads with 2+ PRs",
     "and json_array_length(coalesce(json_extract(t.payload_json, '$.pullRequests'), '[]')) >= 2"),
]
SCOPES = [
    ("Peter", "json_extract(t.payload_json, '$.createdBy') = 'user' "
              "and json_extract(t.payload_json, '$.lineage.parentThreadId') is null"),
    ("Agent-started", "coalesce(json_extract(t.payload_json, '$.createdBy'), '') <> 'user' "
                  "and json_extract(t.payload_json, '$.lineage.parentThreadId') is null"),
    ("Subagents", "json_extract(t.payload_json, '$.lineage.parentThreadId') is not null"),
]
# A command that prints the file: the reader starts a pipeline segment (or a `zsh -lc`
# string), and the path follows in that segment with no redirect between them.
READ_COMMAND = (r"""(?:^|[;&|\n(]|-lc\s+["']?)\s*(?:sudo\s+)?"""
                r"(?:cat|sed\s+-n|head|tail|nl|bat|less|more)\b[^|;&\n>]*{path}")
SQL = """
with editing as (
  select distinct thread_id from orchestration_v2_projection_turn_items
  where type = 'file_change' and updated_at > :start
),
scoped as (
  select t.thread_id from orchestration_v2_projection_threads t join editing using (thread_id)
  where {scope} {extra}
),
readers as (
  select distinct i.thread_id from orchestration_v2_projection_turn_items i join scoped using (thread_id)
  where (i.type = 'command_execution' and json_extract(i.payload_json, '$.input') regexp :command)
     or (i.type = 'dynamic_tool' and lower(json_extract(i.payload_json, '$.toolName')) = 'read'
         and json_extract(i.payload_json, '$.input') like :path)
     or (i.type = 'dynamic_tool' and lower(json_extract(i.payload_json, '$.toolName')) = 'skill'
         and (json_extract(i.payload_json, '$.input.skill') = :skill
              or json_extract(i.payload_json, '$.input.skill') like '%:' || :skill))
)
select (select count(*) from readers), (select count(*) from scoped)
"""
# --all: every skill in the repo, counted on every thread in the window, not only editing ones.
# Reading a skill is not always using it, so three kinds of thread are left out (home#146):
# threads in the skills repo's own projects (maintenance), threads whose title names a skills PR
# (reviews of a skill change), and threads that read AUDIT_SKILLS or more skills (audits and evals).
AUDIT_SKILLS = 6
REVIEW_TITLE = re.compile(r"skills?\s*(PR\s*)?#\d+", re.I)
USAGE_SQL = """
with scoped as (
  select t.thread_id, coalesce(json_extract(t.payload_json, '$.title'), '') as title
  from orchestration_v2_projection_threads t
  where {scope}
    and coalesce(json_extract(t.payload_json, '$.projectId'), '') not in ({skill_projects})
)
select distinct i.thread_id, scoped.title from orchestration_v2_projection_turn_items i join scoped using (thread_id)
where i.updated_at > :start and (
     (i.type = 'command_execution' and json_extract(i.payload_json, '$.input') regexp :command)
  or (i.type = 'dynamic_tool' and lower(json_extract(i.payload_json, '$.toolName')) = 'read'
      and json_extract(i.payload_json, '$.input') like :path)
  or (i.type = 'dynamic_tool' and lower(json_extract(i.payload_json, '$.toolName')) = 'skill'
      and (json_extract(i.payload_json, '$.input.skill') = :skill
           or json_extract(i.payload_json, '$.input.skill') like '%:' || :skill)))
"""
REPO = pathlib.Path(__file__).resolve().parents[2]


def since(value):
    m = re.fullmatch(r"(\d+)([hd])", value)
    if not m:
        return None
    n, unit = int(m[1]), m[2]
    try:
        start = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=n if unit == "h" else 24 * n)
    except OverflowError:
        return None
    return start.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def cell(read, total):
    return f"{read}/{total} ({round(100 * read / total)}%)" if total else "0/0"


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--since", default="7d", help="window, like 24h or 14d (default 7d)")
    parser.add_argument("--all", action="store_true",
                        help="count threads that read each skill in the repo, every thread, by who started it")
    args = parser.parse_args(argv)
    start = since(args.since)
    if start is None:
        parser.error("--since takes a number of hours or days, like 24h or 7d")
    if args.all:
        usage(start, args.since)
        return

    try:
        db = sqlite3.connect(f"file:{USERDATA / 'statev2.sqlite'}?mode=ro", uri=True)
        db.create_function("regexp", 2, lambda pattern, text: text is not None and re.search(pattern, text) is not None,
                           deterministic=True)
        rows = []
        for skill, measured_on, extra in SKILLS:
            params = {"start": start, "skill": skill, "path": f"%{skill}/SKILL.md%",
                      "command": READ_COMMAND.format(path=re.escape(f"{skill}/SKILL.md"))}
            counts = [db.execute(SQL.format(scope=where, extra=extra), params).fetchone() for _, where in SCOPES]
            total = [sum(c[i] for c in counts) for i in (0, 1)]
            rows.append([f"`{skill}`", measured_on, *(cell(*c) for c in counts), cell(*total)])
    except sqlite3.Error as e:
        print(f"adherence.py: T3 database not readable or layout changed ({e}).", file=sys.stderr)
        sys.exit(3)

    header = ["Skill", f"Measured on, last {args.since}", *(name for name, _ in SCOPES), "All"]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for row in rows:
        print("| " + " | ".join(row) + " |")


def usage(start, window):
    """One row per skill: threads that read it in the window, by who started the thread."""
    try:
        db = sqlite3.connect(f"file:{USERDATA / 'statev2.sqlite'}?mode=ro", uri=True)
        db.create_function("regexp", 2, lambda pattern, text: text is not None and re.search(pattern, text) is not None,
                           deterministic=True)
        # The skills repo's projects: any project rooted at a checkout of this repo (~/skills, ~/Projects/skills).
        projects = [pid for pid, root in db.execute("select project_id, workspace_root from projection_projects")
                    if root and pathlib.Path(root).name == REPO.name or (root and pathlib.Path(root).name == "skills")]
        skill_projects = ", ".join("'" + p.replace("'", "''") + "'" for p in projects) or "''"
        readers = {}  # (skill, scope index) -> {thread_id: title}
        skills = sorted(p.parent.name for p in REPO.glob("*/SKILL.md"))
        for skill in skills:
            params = {"start": start, "skill": skill, "path": f"%{skill}/SKILL.md%",
                      "command": READ_COMMAND.format(path=re.escape(f"{skill}/SKILL.md"))}
            for n, (_, where) in enumerate(SCOPES):
                readers[skill, n] = dict(db.execute(USAGE_SQL.format(scope=where, skill_projects=skill_projects), params))
    except sqlite3.Error as e:
        print(f"adherence.py: T3 database not readable or layout changed ({e}).", file=sys.stderr)
        sys.exit(3)
    per_thread = {}
    for threads in readers.values():
        for thread_id in threads:
            per_thread[thread_id] = per_thread.get(thread_id, 0) + 1
    rows = []
    for skill in skills:
        counts = [sum(1 for thread_id, title in readers[skill, n].items()
                      if per_thread[thread_id] < AUDIT_SKILLS and not REVIEW_TITLE.search(title))
                  for n in range(len(SCOPES))]
        rows.append((sum(counts), skill, counts))
    header = ["Skill", *(name for name, _ in SCOPES), f"Threads, last {window}"]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for total, skill, counts in sorted(rows, key=lambda r: (-r[0], r[1])):
        print("| " + " | ".join([f"`{skill}`", *map(str, counts), str(total)]) + " |")


if __name__ == "__main__":
    main(sys.argv[1:])
