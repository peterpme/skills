#!/usr/bin/env python3
"""Digest new turns from this machine's T3 Code threads.

usage: digest.py [--since 7d] [--skip THREAD_ID]... [--out FILE]
       digest.py --baseline   start the cursor at now without a digest
       digest.py --commit     advance the cursor to the last digest run

Reads this machine's T3 database read-only and writes a Markdown digest of every
user-role message created after the cursor (or the last --since window, default
7d, when there is no cursor yet), each with the end of the agent message just
before it. Prints one stats line.

Quiet path: when no thread has anything new, no digest is written, the cursor
is advanced at once and the one line printed starts with "nothing new". The
hourly run then costs one script call.

Peter's own messages are shown plainly. Messages that an agent, watchdog or
schedule sent into a thread are tagged [automated: <source>]; identical ones are
shown once with a count. A thread is included when Peter wrote in it during the
window, or when it got automated messages and Peter has written in it before.
Subagent threads, threads titled "Skill scout…" and --skip ids are left out.

State lives in ~/.local/state/skill-scout/ (override with SKILL_SCOUT_STATE):
cursor.json holds the committed cursor and pending.json the cursor the last
digest would commit. The database is $T3CODE_HOME/userdata/statev2.sqlite
(default ~/.t3). Exit 3 means the database layout was not recognised.
"""

import datetime as dt
import json
import os
import pathlib
import re
import sqlite3
import sys

USER_CAP = 1500
AGENT_TAIL = 400
STATE = pathlib.Path(os.environ.get("SKILL_SCOUT_STATE", "~/.local/state/skill-scout")).expanduser()
USERDATA = pathlib.Path(os.environ.get("T3CODE_HOME", "~/.t3")).expanduser() / "userdata"

THREADS_SQL = """
select thread_id, project_id, title, json_extract(payload_json, '$.pullRequests')
from orchestration_v2_projection_threads
where deleted_at is null
  and json_extract(payload_json, '$.lineage.parentThreadId') is null
  and lower(title) not like 'skill scout%'
"""
MESSAGES_SQL = """
select thread_id, created_at, json_extract(payload_json, '$.createdBy'),
       json_extract(payload_json, '$.creationSource'), json_extract(payload_json, '$.text')
from orchestration_v2_projection_messages
where role = 'user' and streaming = 0 and created_at > ? and created_at <= ?
order by thread_id, created_at
"""
PREV_AGENT_SQL = """
select json_extract(payload_json, '$.text') from orchestration_v2_projection_messages
where thread_id = ? and role = 'assistant' and streaming = 0 and created_at < ?
order by created_at desc limit 1
"""
PETER_EVER_SQL = """
select 1 from orchestration_v2_projection_messages
where thread_id = ? and role = 'user' and coalesce(json_extract(payload_json, '$.createdBy'), 'user') = 'user'
limit 1
"""


def iso(t):
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def parse_since(value):
    m = re.fullmatch(r"(\d+)([hd])", value)
    if not m:
        sys.exit(f"digest.py: --since takes e.g. 12h or 7d, not {value!r}")
    hours = int(m.group(1)) * (24 if m.group(2) == "d" else 1)
    return dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)


def clip(text, cap, tail=False):
    text = (text or "").strip()
    if len(text) <= cap:
        return text
    return "…" + text[-cap:] if tail else text[:cap] + f"… [+{len(text) - cap} chars]"


def quote(text):
    return "\n".join("> " + line for line in text.splitlines()) or ">"


def local(ts):
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone().strftime("%m-%d %H:%M")


def project_titles():
    try:
        db = sqlite3.connect(f"file:{USERDATA / 'state.sqlite'}?mode=ro", uri=True)
        return dict(db.execute("select project_id, title from projection_projects"))
    except sqlite3.Error:
        return {}


def write_json(name, value):
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / name).write_text(json.dumps(value, indent=1))


def main(argv):
    now = dt.datetime.now(dt.timezone.utc)
    if argv in (["-h"], ["--help"]):
        print(__doc__.strip())
        return
    if argv == ["--baseline"]:
        write_json("cursor.json", {"cursor": iso(now)})
        print(f"cursor set to {iso(now)}")
        return
    if argv == ["--commit"]:
        pending = STATE / "pending.json"
        if not pending.exists():
            sys.exit("digest.py: nothing pending")
        write_json("cursor.json", json.loads(pending.read_text()))
        pending.unlink()
        print(f"cursor advanced to {json.loads((STATE / 'cursor.json').read_text())['cursor']}")
        return

    since, out, skip = None, None, set()
    it = iter(argv)
    for arg in it:
        if arg == "--since":
            since = parse_since(next(it, ""))
        elif arg == "--skip":
            skip.add(next(it, ""))
        elif arg == "--out":
            out = pathlib.Path(next(it, "")).expanduser()
        else:
            sys.exit(f"digest.py: unknown argument {arg!r} (see --help)")
    cursor_file = STATE / "cursor.json"
    if cursor_file.exists():
        start = json.loads(cursor_file.read_text())["cursor"]
    else:
        start = iso(since or parse_since("7d"))
    end = iso(now)

    try:
        db = sqlite3.connect(f"file:{USERDATA / 'statev2.sqlite'}?mode=ro", uri=True)
        threads = {r[0]: r for r in db.execute(THREADS_SQL) if r[0] not in skip}
        rows = [r for r in db.execute(MESSAGES_SQL, (start, end)) if r[0] in threads]
    except sqlite3.Error as e:
        print(f"digest.py: T3 database not readable or layout changed ({e}). "
              "Read threads with t3_thread_read instead.", file=sys.stderr)
        sys.exit(3)

    by_thread = {}
    for tid, created, by, source, text in rows:
        by_thread.setdefault(tid, []).append((created, by or "user", source or "?", text or ""))

    projects = project_titles()
    sections, n_peter, n_auto = [], 0, 0
    for tid, msgs in sorted(by_thread.items(), key=lambda kv: kv[1][-1][0], reverse=True):
        peter = [m for m in msgs if m[1] == "user"]
        if not peter and not db.execute(PETER_EVER_SQL, (tid,)).fetchone():
            continue
        _, project_id, title, prs_json = threads[tid]
        prs = ", ".join(p.get("url", "") for p in json.loads(prs_json or "[]"))
        lines = [
            f"## [{title}](t3-thread://v1/{tid})",
            f"`{tid}` · project {projects.get(project_id, project_id)}" + (f" · PRs: {prs}" if prs else ""),
            "",
        ]
        repeats = {}
        for m in msgs:
            if m[1] != "user":
                key = m[3].strip()[:160]
                repeats[key] = repeats.get(key, 0) + 1
        shown = set()
        for created, by, source, text in msgs:
            prev = db.execute(PREV_AGENT_SQL, (tid, created)).fetchone()
            if by == "user":
                label = f"**Peter, {local(created)}:**"
                n_peter += 1
            else:
                key = text.strip()[:160]
                if key in shown:
                    continue
                shown.add(key)
                count = f" ×{repeats[key]}" if repeats[key] > 1 else ""
                label = f"**[automated: {source}]{count}, {local(created)}:**"
                n_auto += 1
            if prev and prev[0]:
                lines.append(f"Agent, just before:\n{quote(clip(prev[0], AGENT_TAIL, tail=True))}\n")
            lines.append(f"{label}\n{quote(clip(text, USER_CAP))}\n")
        sections.append("\n".join(lines))

    if not sections:
        write_json("cursor.json", {"cursor": end})
        (STATE / "pending.json").unlink(missing_ok=True)
        print(f"nothing new since {local(start)}; cursor advanced to {end}")
        return

    stamp = now.astimezone().strftime("%Y-%m-%d-%H%M")
    out = out or STATE / "digests" / f"{stamp}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    body = f"# T3 digest, {local(start)} to {local(end)}\n\n" + "\n---\n\n".join(sections)
    out.write_text(body)
    write_json("pending.json", {"cursor": end})
    print(f"digest {out}: {len(sections)} threads, {n_peter} messages from Peter, "
          f"{n_auto} automated, {len(body)} chars, window {start} to {end}")


if __name__ == "__main__":
    main(sys.argv[1:])
