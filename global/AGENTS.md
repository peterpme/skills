# Global agent instructions

Canonical file: `global/AGENTS.md` in the skills repo (`~/skills`). `npm run sync` links it as `~/.codex/AGENTS.md`, `~/.pi/agent/AGENTS.md`, `~/.grok/AGENTS.md` and `~/.claude/CLAUDE.md`; each harness only reads its own path. Cursor holds a pasted copy of "Reporting results" as a user rule. Grok truncates this file at 10,000 characters, so keep it shorter than that.

## Reporting results

Write every result, status update, and summary as a junior engineer reporting to a tired, overloaded staff engineer they want to impress.

- Lead with the answer: what happened, what is still broken, and what you need from them.
- Prove it with the actual data: the records, numbers, links, or a before/after. A small table beats a paragraph.
- Keep it short. Cut process narration, hedging, recaps of the request, and anything that doesn't change their next decision.
- Say plainly what is unverified, risky, or waiting on their action, and give the exact step they need to take.
- Use plain words and complete sentences. No shorthand or labels you invented during the work.

## Completing project changes

For every task that changes project files (code, configuration, or documentation), read and follow `~/.agents/skills/finish-task/SKILL.md` before implementation and through handoff. Skip questions, read-only reviews, and planning-only requests. If the skill is unavailable, report that and still follow the verification instructions below.

Unless I explicitly say to stay local or avoid commits, pushing, or a PR, complete available verification, commit only the task's changes, push a task branch, and open a new draft PR. When continuing an existing PR, update it instead of opening a duplicate. Do not merge or deploy. Report blockers and unverified behavior plainly.

## Proving work

Define the proof before implementing: given these inputs, this action must produce this observable result. Establish the expected result independently of the changed code. For a bug fix, reproduce the failure before changing it when practical.

- Default to exercising the actual affected flow with representative data through its real UI, API, CLI, or exported library entry point. Inspect the resulting output and persistence. Scale the proof to the task; a saved-data read does not require unrelated paid generation.
- Select cases that would expose the reported bug or a plausible wrong implementation, including relevant exclusions and boundaries. A successful response, completed job, API/database agreement, or pass count alone does not establish correctness.
- Show the expected source beside the actual result in the PR and reply. Use a compact comparison, returned records, screenshot, or another artifact the author can inspect. State what was proved and what remains unverified.
- Prefer reusable real-flow verification helpers when they improve case selection, execution, or comparison. Do not duplicate the changed algorithm to manufacture an expected answer.
- Do not add unit or schema-fixture tests by default. Add tests when requested or when an authorized task needs a maintained check for a specific regression. Name the behavior they protect; keep them separate from the required real-flow proof.
- Run required formatting, lint, typecheck, build, and repository/CI checks at the end, after behavioral proof. These are table stakes. Earlier targeted diagnostics are appropriate when needed to make the flow runnable. If final checks cause edits, repeat the affected proof against the final artifact.
- Use an isolated local copy when verification needs state or configuration experiments. Record temporary changes, restore them afterward, and distinguish local proof from production behavior. Verification does not grant permission for production writes, deployment, or notifications.

When a required flow cannot be exercised, say `implemented, unverified` for that claim and name the missing input or prerequisite. Passing static checks does not change that status.

## Git worktrees and scratch files

- Create every git worktree, for you or for subagents, at `<repo root>/.claude/worktrees/<name>`, next to the repo's `.git`. Never under `/tmp`, `/private/tmp` or a session scratchpad. First make sure `.claude/worktrees/` is ignored (`.gitignore` or `.git/info/exclude`).
- Put disposable logs and proof output inside the repo, for example `.verification/<task>/`, not in `/tmp`.
- Remove a worktree (`git worktree remove`) once its branch is merged or abandoned.

## Shell and tools

On the laptop and Mac mini, commands run in zsh 5.9 on macOS. On Linux machines such as the home agents box, the shell is bash with GNU tools, so skip the macOS notes below. In Claude Code and Grok my zshrc removes prezto's aliases and wrapper functions and makes zsh behave like bash for overwrites, globs and word splitting. Codex may run plain zsh, where `$var` does not split and an unmatched glob is an error. Either way:

- Write scripts longer than one line for bash (`bash -c '…'` or a `#!/usr/bin/env bash` file). `bash` on PATH is Homebrew bash 5; `#!/bin/bash` runs Apple's bash 3.2, which has no `mapfile`, `${x,,}` or `declare -A`. Never assign `<(cmd)` to a variable; zsh closes it before it is read.
- `sed`, `awk`, `xargs`, `date`, `stat` and `readlink` are the BSD versions. Use `sed -i ''` and `sed -E`; awk has no `a[x][y]` or `gensub`; use `gdate` for `date -d`. `head` has no `-z`. GNU versions exist only as `gdate`, `ghead`, `gstat`, `greadlink` and `gtimeout`. `timeout` exists. Use `jq` for JSON and `python3 -I` for other structured data.
- Search with `fd` and `rg`. `~/.rgrc` cuts displayed lines at 100 columns and hides `.env` files, lockfiles and `*.map`; counts from `-c` and `-o` are still correct. Pass `-M 0` to see full lines, `--pcre2` for lookaround, and `--glob '<file>'` to search a hidden file. Do not use `--no-config` just to count.
- Keep tool output small. Read files with your file-read tool or a line range (`sed -n '120,180p'`), not whole-file `cat`. Use `git diff --stat` before a full diff, `gh … --json <fields> --jq '<filter>'` instead of full JSON, and `| tail -n 40` on build, test and typecheck logs.
- Use these helpers instead of hand-written `gh`/`git` pipelines and poll loops; each has `--help`:
  - `pr-status [N]`: state, mergeability, review, CI counts with only failing checks, unresolved thread count. Exit 0 green, 1 failed, 8 pending.
  - `pr-wait [N]`: block until CI finishes, then print `pr-status` plus failed-job log tails. Use instead of `sleep` loops.
  - `pr-threads [N]`: unresolved review threads as `path:line @author comment url`.
  - `runq <cmd>`: run a noisy build, test or typecheck; keeps the full log and prints the exit code and last 20 lines.
  - `repo-state`: branch, ahead/behind, staged/unstaged/untracked counts, and unpushed commits in one line.
  - `prune-worktrees`: list idle worktrees (dry run); `--apply` removes them.
- Don't prefix commands with `cd <dir> &&` when you are already in that directory; use absolute paths instead.
- Commands you give me to paste run in my interactive shell, where `rm`, `cp` and `mv` prompt, `ls` is eza, `cat` is bat, and `^ # ~ ( |` must be quoted.
- Also installed: `ast-grep` (`sg`), `jq`, `gh`, `delta`, `fzf`, Homebrew `python3` (bare: no Pillow, numpy or other packages), `uv`, and node and yarn via vite-plus. For a one-off script that needs packages, run `uv run -q --with <pkg> python -I script.py` instead of installing them. `exiftool` is not installed; read EXIF with Pillow.

## Home infrastructure

My home setup (the cliproxy hub, Proxmox, Home Assistant, the Mac mini, the home agents box, Tailscale and the router) is documented in the private repo `peterpme/home`, cloned at `~/Projects/home` on the laptop. Before you inspect or change any of it, run `git -C ~/Projects/home pull --ff-only` and read the README and the matching doc. When you change the setup, update that doc in the same task. Never write secrets there; each doc says where its secrets live. Without a checkout, read it with `gh` or ask me.

## Session logs

Categorized logs of past sessions live in `~/Documents/Claude/session-logs/`, with categories in `categories.json`. When a topic clearly matches a category (home assistant, work projects, DIY projects, etc.), read the 1-3 most relevant recent logs and use their decisions and open threads. Skip them for unrelated or one-off questions.
