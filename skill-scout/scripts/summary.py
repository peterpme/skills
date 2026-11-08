#!/usr/bin/env python3
"""Once-a-day bookkeeping for the hourly skill scout.

usage: summary.py daily          exit 0 on the first run after 06:00 local time each day, else 1
       summary.py note TEXT...    append one line to the day's summary
       summary.py post            print the day's lines and clear them; exit 1 when there are none

The scout runs every hour. `daily` tells one run a day to do the daily work (the
command-cost pass and the summary comment on the Morning brief) and records the
date, so the other runs skip it. `note` collects what each run changed. `post`
hands the collected lines to the run that comments and empties the file, so a
day with nothing to report posts nothing.

State lives in ~/.local/state/skill-scout/ (override with SKILL_SCOUT_STATE):
summary.json holds the date of the last daily run, day.md the collected lines.
"""

import datetime as dt
import json
import os
import pathlib
import sys

STATE = pathlib.Path(os.environ.get("SKILL_SCOUT_STATE", "~/.local/state/skill-scout")).expanduser()
DAILY_HOUR = 6


def read_json(name):
    path = STATE / name
    return json.loads(path.read_text()) if path.exists() else {}


def write_json(name, value):
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / name).write_text(json.dumps(value, indent=1))


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0 if argv else 2
    cmd, rest = argv[0], argv[1:]
    day = STATE / "day.md"
    now = dt.datetime.now().astimezone()
    today = now.strftime("%Y-%m-%d")

    if cmd == "daily":
        state = read_json("summary.json")
        if now.hour < DAILY_HOUR:
            print(f"not due: before {DAILY_HOUR:02d}:00 local")
            return 1
        if state.get("daily") == today:
            print(f"not due: daily run already done on {today}")
            return 1
        state["daily"] = today
        write_json("summary.json", state)
        print(f"daily run: {today}")
        return 0

    if cmd == "note":
        text = " ".join(rest).strip()
        if not text:
            sys.exit("summary.py note: give the line to add")
        STATE.mkdir(parents=True, exist_ok=True)
        with day.open("a") as f:
            f.write(f"- {now.strftime('%H:%M')} {text}\n")
        print(f"noted ({sum(1 for _ in day.open())} lines today)")
        return 0

    if cmd == "post":
        lines = day.read_text().strip() if day.exists() else ""
        if not lines:
            print("nothing to post")
            return 1
        print(lines)
        day.write_text("")
        state = read_json("summary.json")
        state["posted"] = today
        write_json("summary.json", state)
        return 0

    sys.exit(f"summary.py: unknown command {cmd!r} (see --help)")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
