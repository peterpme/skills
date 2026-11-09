#!/usr/bin/env python3
"""Skill read rates from this machine's T3 Code database, one row per skill.

usage: adherence.py [--since 7d]

For each skill: of the threads that changed files in the window, how many read
the skill at any point. Columns split threads by who started them: Peter
(top-level threads he created), agent-started (top-level threads a schedule,
the Desk or another agent created) and subagents (any thread with a parent). orchestrate counts
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
# A command that prints the file: the reader and the path in one pipeline segment.
READ_COMMAND = r"\b(cat|sed -n|head|tail|nl|bat|less|more)\b[^|;&\n]*{path}"
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
     or (i.type = 'dynamic_tool' and json_extract(i.payload_json, '$.toolName') = 'Read'
         and json_extract(i.payload_json, '$.input') like :path)
     or (i.type = 'dynamic_tool' and json_extract(i.payload_json, '$.toolName') = 'Skill'
         and (json_extract(i.payload_json, '$.input.skill') = :skill
              or json_extract(i.payload_json, '$.input.skill') like '%:' || :skill))
)
select (select count(*) from readers), (select count(*) from scoped)
"""


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
    args = parser.parse_args(argv)
    start = since(args.since)
    if start is None:
        parser.error("--since takes a number of hours or days, like 24h or 7d")

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


if __name__ == "__main__":
    main(sys.argv[1:])
