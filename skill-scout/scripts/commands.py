#!/usr/bin/env python3
"""Rank the shell commands agents ran on this machine by the output they pulled into context.

usage: commands.py [--since 7d] [--top 15] [--out FILE]

Reads this machine's T3 database read-only: every shell command an agent ran (any harness,
subagents included) in the window that starts at the skill-scout cursor (or --since, default 7d,
when there is no cursor). Output size is measured in characters; tokens are estimated as chars/4.
Never writes the cursor: digest.py --commit does that.

Writes a Markdown report to ~/.local/state/skill-scout/commands/<time>.md and prints one stats
line. The report has three tables:
  - Programs: the leading program (plus subcommand for git, gh, mise, brew…) by total output.
  - Repeated commands: the same command shape (paths, numbers, hashes and quoted text replaced
    by placeholders) run in 2+ threads, by total output. These are helper candidates.
  - Largest outputs: single runs that dumped the most.
Exit 3 means T3's database layout was not recognised.
"""

import collections
import datetime as dt
import json
import os
import pathlib
import re
import shlex
import sqlite3
import sys

STATE = pathlib.Path(os.environ.get("SKILL_SCOUT_STATE", "~/.local/state/skill-scout")).expanduser()
DB = pathlib.Path(os.environ.get("T3CODE_HOME", "~/.t3")).expanduser() / "userdata" / "statev2.sqlite"
SUBCOMMAND_TOOLS = {"git", "gh", "mise", "brew", "npm", "pnpm", "vp", "cargo", "docker", "kubectl",
                    "launchctl", "systemctl", "tailscale", "uv", "bun", "just", "railway", "wrangler"}
WRAPPERS = {"env", "command", "builtin", "exec", "nice", "time", "sudo", "nohup", "caffeinate"}
SQL = """
select thread_id, json_extract(payload_json, '$.input'), json_extract(payload_json, '$.output'),
       coalesce(json_extract(payload_json, '$.startedAt'), updated_at)
from orchestration_v2_projection_turn_items
where type = 'command_execution' and updated_at > ?
"""
SKIP_THREADS_SQL = "select thread_id from orchestration_v2_projection_threads where lower(title) like 'skill scout%'"


def window_start(since):
    if since:
        m = re.fullmatch(r"(\d+)([hd])", since)
        if not m:
            sys.exit(f"commands.py: --since takes e.g. 12h or 7d, not {since!r}")
        hours = int(m.group(1)) * (24 if m.group(2) == "d" else 1)
        start = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
        return start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    cursor = STATE / "cursor.json"
    if cursor.exists():
        return json.loads(cursor.read_text())["cursor"]
    return window_start("7d")


def words(segment):
    try:
        w = shlex.split(segment, posix=True)
    except ValueError:
        w = segment.split()
    w = [x for x in w if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", x)]
    while w and (w[0] in WRAPPERS or w[0] == "timeout"):
        w = w[2:] if w[0] == "timeout" else w[1:]
        while w and w[0].startswith("-"):
            w = w[1:]
    return w


def program(command):
    """Leading program of the first real step, e.g. 'git log' or 'rg'. 'cd x &&' is skipped."""
    for segment in re.split(r"&&|\|\||;|\n", command):
        w = words(segment.split("|")[0])
        while w and w[0] in ("do", "then", "else", "{", "(", "!"):
            w = w[1:]                                   # the command inside a loop or branch
        if not w or w[0] in ("cd", "set", "export", "source", ".", "local", "mkdir", "true",
                             "for", "while", "until", "if", "elif", "case", "done", "fi", "esac", "}", ")"):
            continue
        if re.fullmatch(r"[\w-]+\(\)", w[0]) or (len(w) > 1 and w[1] == "()"):
            continue                                    # a function definition
        name = w[0].rsplit("/", 1)[-1]
        if name in SUBCOMMAND_TOOLS:
            sub = next((x for x in w[1:] if not x.startswith("-") and "=" not in x), "")
            # git -C path log: skip the -C value
            if name == "git" and "-C" in w:
                rest = w[w.index("-C") + 2:]
                sub = next((x for x in rest if not x.startswith("-")), sub)
            return f"{name} {sub}".strip()
        return name
    return "(other)"


def shape(command):
    """Command with the variable parts replaced, so reruns with other paths or ids group together."""
    s = command.strip()
    s = re.sub(r"<<'?(\w+)'?\n.*?\n\1\b", r"<<\1 …", s, flags=re.S)       # heredoc bodies
    s = re.sub(r"'[^']*'|\"[^\"]*\"", "'…'", s)                             # quoted text
    s = re.sub(r"(~|\$HOME|/)[\w.@%+~/-]*", "PATH", s)                       # paths
    s = re.sub(r"\b[0-9a-f]{7,40}\b", "HASH", s)                             # git hashes, ids
    s = re.sub(r"\b\d+\b", "N", s)                                           # numbers
    s = re.sub(r"\s+", " ", s)
    return s[:160]


def clip(text, n):
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def main(argv):
    if argv and argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return
    opts = {"--since": None, "--top": "15", "--out": None}
    it = iter(argv)
    for arg in it:
        if arg not in opts:
            sys.exit(f"commands.py: unknown argument {arg!r} (see --help)")
        opts[arg] = next(it, None)
    top = int(opts["--top"])
    if not DB.exists():
        sys.exit(f"commands.py: no T3 database at {DB}")
    start = window_start(opts["--since"])
    try:
        con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        skip = {r[0] for r in con.execute(SKIP_THREADS_SQL)}
        rows = [r for r in con.execute(SQL, (start,)) if r[0] not in skip and r[1] and r[1] != "Preparing workspace"]
    except sqlite3.Error as e:
        print(f"commands.py: T3 database layout not recognised: {e}", file=sys.stderr)
        sys.exit(3)

    by_program = collections.defaultdict(lambda: {"runs": 0, "chars": 0, "threads": set()})
    by_shape = collections.defaultdict(lambda: {"runs": 0, "chars": 0, "threads": set(), "example": None})
    for thread, cmd, out, _ in rows:
        n = len(out or "")
        p = by_program[program(cmd)]
        p["runs"] += 1; p["chars"] += n; p["threads"].add(thread)
        s = by_shape[shape(cmd)]
        s["runs"] += 1; s["chars"] += n; s["threads"].add(thread)
        if s["example"] is None or len(cmd) < len(s["example"]):
            s["example"] = cmd
    total = sum(len(r[2] or "") for r in rows)

    def tok(chars):
        return f"{round(chars / 4):,}"

    lines = [f"# Agent shell commands since {start}", "",
             f"{len(rows)} commands in {len({r[0] for r in rows})} threads, about {tok(total)} tokens of output.", "",
             "## Programs", "", "| Program | Runs | Threads | ~Tokens | ~Avg |", "|---|---:|---:|---:|---:|"]
    for name, v in sorted(by_program.items(), key=lambda kv: -kv[1]["chars"])[:top]:
        lines.append(f"| `{name}` | {v['runs']} | {len(v['threads'])} | {tok(v['chars'])} | {tok(v['chars'] / v['runs'])} |")
    lines += ["", "## Repeated commands (2+ threads)", "", "| Shape | Runs | Threads | ~Tokens | Example |", "|---|---:|---:|---:|---|"]
    repeated = [(k, v) for k, v in by_shape.items() if len(v["threads"]) >= 2]
    for k, v in sorted(repeated, key=lambda kv: -kv[1]["chars"])[:top]:
        lines.append(f"| `{clip(k, 70)}` | {v['runs']} | {len(v['threads'])} | {tok(v['chars'])} | `{clip(v['example'], 70)}` |")
    lines += ["", "## Largest outputs", "", "| ~Tokens | Thread | Command |", "|---:|---|---|"]
    for thread, cmd, out, _ in sorted(rows, key=lambda r: -len(r[2] or ""))[:5]:
        lines.append(f"| {tok(len(out or ''))} | {thread[:8]} | `{clip(cmd, 90)}` |")

    out_dir = STATE / "commands"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = pathlib.Path(opts["--out"]) if opts["--out"] else out_dir / (dt.datetime.now().strftime("%Y-%m-%dT%H%M") + ".md")
    out_file.write_text("\n".join(lines).replace("|`", "| `") + "\n")
    print(f"{len(rows)} commands, ~{tok(total)} tokens of output, {len(repeated)} repeated shapes -> {out_file}")


if __name__ == "__main__":
    main(sys.argv[1:])
