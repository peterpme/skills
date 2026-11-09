#!/usr/bin/env python3
"""Skill read rates from this machine's T3 Code database, one row per skill.

usage: adherence.py [--since 7d]

For each skill: of the threads that changed files in the window, how many read
the skill at any point. Columns split threads by who started them: Peter
(top-level threads he created), scheduled (top-level threads an agent or
schedule created) and subagents (any thread with a parent). orchestrate counts
only threads that linked two or more pull requests, the multi-PR work it owns.

A thread read a skill when a shell command or tool call names
`<skill>/SKILL.md` in its input, or a Skill tool call loads it by name. A
prompt or brief that only mentions the path does not count. Deleted threads
count, so scheduled runs that were cleaned up still show.

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
    ("Scheduled", "coalesce(json_extract(t.payload_json, '$.createdBy'), '') <> 'user' "
                  "and json_extract(t.payload_json, '$.lineage.parentThreadId') is null"),
    ("Subagents", "json_extract(t.payload_json, '$.lineage.parentThreadId') is not null"),
]
SQL = """
with editing as (
  select distinct thread_id from orchestration_v2_projection_turn_items
  where type = 'file_change' and updated_at > ?
),
scoped as (
  select t.thread_id from orchestration_v2_projection_threads t join editing using (thread_id)
  where {scope} {extra}
),
readers as (
  select distinct i.thread_id from orchestration_v2_projection_turn_items i join scoped using (thread_id)
  where (i.type in ('command_execution', 'dynamic_tool')
         and json_extract(i.payload_json, '$.input') like ?)
     or (i.type = 'dynamic_tool' and json_extract(i.payload_json, '$.toolName') = 'Skill'
         and json_extract(i.payload_json, '$.input.skill') = ?)
)
select (select count(*) from readers), (select count(*) from scoped)
"""


def since(value):
    m = re.fullmatch(r"(\d+)([hd])", value)
    if not m:
        return None
    n, unit = int(m[1]), m[2]
    start = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=n if unit == "h" else 24 * n)
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
        rows = []
        for skill, measured_on, extra in SKILLS:
            counts = [db.execute(SQL.format(scope=where, extra=extra), (start, f"%{skill}/SKILL.md%", skill)).fetchone()
                      for _, where in SCOPES]
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
