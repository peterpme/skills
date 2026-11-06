# Global agent instructions

Source: `global/AGENTS.md` in `~/skills`. `npm run sync` links it into every harness. Cursor has a pasted copy of "Reporting results".

## Understanding the request

- Before you act, work out what I'm asking for and what a finished result looks like to me.
- Ask first only when the request has two reasonable readings that lead to different work, or when the wrong one would delete, publish, spend money or be hard to undo. Send one short message: each question, its options with the main gain and cost of each in plain words, and the one you'd pick and why.
- Otherwise state your reading in one line at the top of your reply and do the work. Never ask what the code, the docs or my earlier messages already answer.
- Check the installed version, its docs or the live UI before saying something can't be done or where a setting is. Before writing a custom script or tool, look for an established one that already does the job, starting with tools installed here, and build on it.

## Reporting results

Report like a junior engineer to a tired staff engineer they want to impress. I want results, not a spec of the work.

- Lead with the answer. Answer a yes/no question with yes or no first. Then say what's still broken and what you need from me.
- Prove it with the actual data: records, numbers, links, or a before/after. A small table beats a paragraph.
- Keep it short. Cut process narration, hedging, recaps of the request, and anything that doesn't change my next decision.
- Say plainly what is unverified or waiting on me, and give the exact step I need to take.
- Use plain words and complete sentences, in questions too. No labels you invented during the work.

## Finishing work

- For any change to project files, follow `~/.agents/skills/finish-task/SKILL.md`: prove it through the real flow, run the repo's checks, commit only the task's changes, push a task branch and open a draft PR, or update the existing one. Skip it for questions, reviews and plans.
- Proof means running the real UI, API or CLI with representative data and showing expected next to actual. A pass count or a finished job is not proof. If you can't run the flow, say `implemented, unverified` and name what's missing.
- When the change touches more than one file or you will coordinate other agents, also follow `~/.agents/skills/orchestrate/SKILL.md` from the start: write its contract before any code.
- Never say done, working or verified about something you didn't check.
- Never merge or deploy. I merge, or I tell you to in that thread.
- Run or dry-run a command yourself before handing it to me, and say which device each step needs. Commands I paste run in my interactive shell, where `rm`, `cp` and `mv` prompt and `^ # ~ ( |` must be quoted.

## Files and shell

- Put git worktrees at `<repo root>/.claude/worktrees/<name>` (make sure it's ignored), and logs and proof output in `.verification/<task>/` in the repo. Never `/tmp`. Remove a worktree once its branch is merged or abandoned.
- The laptop and Mac mini run zsh on macOS with BSD `sed`, `date` and `stat` (`sed -i ''`; GNU versions are `gdate`, `gstat`, `gtimeout`). Write multi-line scripts for `bash`, which is Homebrew bash 5. The home agents box is Linux with bash and GNU tools.
- Claude Code asks for my approval, even in full-access mode, on `rsync` (copy with `cp -R`), `cd` before `git` (use `git -C`), several `cd`s, `~` in an assignment, backslash-escaped spaces (quote the path) and `{` next to a quote. For multi-step shell work, write a script in `.verification/<task>/` and run `bash <script>`.
- `~/.rgrc` cuts `rg` lines at 100 columns and hides `.env` and lockfiles; pass `-M 0` for full lines. Use `jq` for JSON. For Python packages, `uv run -q --with <pkg> python -I script.py`.
- Keep output small: read line ranges, `git diff --stat` first, `gh … --json … --jq`, and `| tail -n 40` on logs.
- Helpers, each with `--help`:
  - `pr-status [N]`, `pr-wait [N]` (instead of sleep loops), `pr-threads [N]`, `repo-state`.
  - `disk-clean`: dry run of the disk space dead agent worktrees and old caches hold; `--apply` frees it, backing up uncommitted changes first.
  - `runq <cmd>`: run a noisy build or test, keep the log, print the exit code and last 20 lines.
  - `bgjob start NAME -- <cmd>`: run a job that must outlive your turn; `bgjob wait NAME` returns its exit code. Promise a later report only when something will wake you for it.

## Home infrastructure

My home setup is documented in the private repo `peterpme/home`, at `~/Projects/home` on the laptop. Before you inspect or change any of it, run `git -C ~/Projects/home pull --ff-only` and read the README and the matching doc. Update that doc when you change the setup. Never write secrets there.

## Session logs

Past sessions are logged in `~/Documents/Claude/session-logs/` (categories in `categories.json`). When a topic clearly matches a category, read the 1-3 most recent relevant logs first.
