# Skills

Personal agent skills. One folder per skill at the repository root.

- [skill-creator](skill-creator/SKILL.md): Anthropic's skill for creating, testing and tuning skills, vendored unchanged (see `UPSTREAM.md`).
- [tldr](tldr/SKILL.md): Cut the last response down to a one-sentence summary, your decisions, and what is next.
- [word-this](word-this/SKILL.md): Make a draft coherent while preserving your voice, casing, and prose. Invoke explicitly; automatic invocation is disabled.
- [ticket](ticket/SKILL.md): One line from Peter becomes one well-formed ledger issue (home or Linear) or a decision issue, filed by a cheap model.
- [chief-of-staff](chief-of-staff/SKILL.md): Daily run that keeps every stream moving: applies the merge and 14-day rules, closes or parks stale work and writes its learnings, posts one brief with only the decisions no rule covers.
- [delegate](delegate/SKILL.md): Delegate investigations, tickets and reviews with model and effort routing, self-contained briefs and stall checks.
- [orchestrate](orchestrate/SKILL.md): Build without Peter steering: a contract (his decisions, acceptance checks, slices, defaulted questions) workers build, one reviewer reports findings that come with a failing command, and only PRs that pass the ready gate reach him. `evals/orchestrate/` replays real tasks to score it.
- [overnight](overnight/SKILL.md): `/overnight <task>` before bed: Opus 5.5 high decides every open question itself, records each as a closed decision issue with a one-word undo, finishes the work, and leaves one summary on the Morning brief.
- [skill-review](skill-review/SKILL.md): Weekly: turns filed findings into one scored change and merges it when the replay eval says it helps, and adds replay cases.
- [skill-gardener](skill-gardener/SKILL.md): Every three days: cuts duplicated, stale and narrated lines from `global/AGENTS.md` and the skills in one PR with a words-before-and-after table, merged when the replay eval holds. `scripts/words` prints the table.
- [effect-v4](effect-v4/SKILL.md): Effect v4 reference for writing, reviewing and testing Effect TypeScript code.
- [clean-disk](clean-disk/SKILL.md): Daily on each machine, free disk space from merged or idle agent worktrees, stale Rust `target/` folders, build folders (through Mole), replaced simulator runtimes and oversized caches. `bin/disk-clean` holds the rules and backs up uncommitted changes first.
- [harness-first](harness-first/SKILL.md): Land a baseline from a harness in the repo before any change meant to improve a number.
- [grilling](grilling/SKILL.md): Before a feature's contract, explore first, then at most three questions per round, each with a default and its gain and cost, and wait for his answers. Wraps Matt Pocock's `grilling` (`grilling/upstream.md`, MIT); two-week trial from 2026-11-08.
- [skill-scout](skill-scout/SKILL.md): Daily read of this machine's T3 threads; Peter's corrections go verbatim into the private home ledger's feedback file, and recurring friction and the shell commands that cost agents the most output become finding issues there, never an open PR. `bin/feedback` is the helper every agent uses to record a correction.
- LLP, Charlie Cheever's Linked Literate Programming (numbered docs in `llp/`, `@ref` pointers in code), copied verbatim from [ccheever/llp](https://github.com/ccheever/llp) v0.5.2 (MIT; `source:` in each frontmatter), except the `description:` lines of all but llp-review, which were tuned for triggering (home#160). Update with `/llp-adopt update` and keep those lines when it shows them in the diff. The pointers are for every task; the review loop is reserved for work where a mistake is expensive (`orchestrate`, "LLP"). [llp-orient](llp-orient/SKILL.md) loads the docs covering a task; [llp-create](llp-create/SKILL.md) writes the next numbered doc; [llp-adopt](llp-adopt/SKILL.md) brings LLP to a repo (scaffold or retrofit); [llp-maintain](llp-maintain/SKILL.md) finds doc and code drift; [llp-review](llp-review/SKILL.md) runs a recorded review; [llp-super-refine](llp-super-refine/SKILL.md) loops reviews from two model families until both say ready; [llp-ship](llp-ship/SKILL.md) plans, builds and delivers tasks end to end.
- [library](library/SKILL.md): Add a book, paper or post to the reading library: save the original, record the source, build the searchable copy, read it, write the brief, link it into the study guide. Written files live in `home/docs/library/`.

The repo also holds the global agent instructions (`global/AGENTS.md`) and agent helper commands (`bin/`).

## Install

```bash
git clone https://github.com/peterpme/skills.git ~/skills
cd ~/skills && npm run setup
```

`npm run setup` installs this checkout's Git hooks and symlinks each skill into the global skill folder of every harness: Claude Code (`~/.claude/skills`), Codex (`~/.codex/skills`), Cursor (`~/.cursor/skills`), Grok (`~/.grok/skills`), Pi (`~/.pi/agent/skills`), Antigravity (`~/.gemini/config/skills`) and the shared `~/.agents/skills`. OpenCode reads `~/.claude/skills` and `~/.agents/skills`. It also links skills for OpenCode, GitHub Copilot, Droid, Gemini CLI and Windsurf when that harness's home folder exists. It links each `bin/` command into `~/.local/bin`, and `global/AGENTS.md` as `~/.codex/AGENTS.md`, `~/.pi/agent/AGENTS.md`, `~/.grok/AGENTS.md` and `~/.claude/CLAUDE.md`. Setup also installs a job that runs `git pull --ff-only` every 30 minutes: a launchd agent on macOS, a systemd user timer on Linux. Its log is `~/.local/state/personal-skills/pull.log`. Run setup once per clone; no dependencies need installing.

`npm run list` shows what the [`skills` CLI](https://github.com/vercel-labs/skills) sees in the global folders. Sync does not use that CLI to install: it copies each skill into `~/.agents/skills` instead of linking the checkout, so edits would stop being live, and it has no support for the global instructions file or `bin/`. Its agent folder table (`docs/agents.md`) is where to look when adding a harness: add the folder to `destinations` or `optional` in `scripts/sync-skills.mjs`.

Edits are live through the symlinks. A merged PR reaches every machine within 30 minutes. `git pull` automatically links new skills after a merge or rebase. Run `npm run sync` to sync manually. If a destination already contains a different folder or link, sync moves it to `~/.local/state/personal-skills/backups/` before linking; it does not delete those files.

Sync links only from the main checkout: run from a linked git worktree it does nothing, so a branch under review never becomes what the harnesses read. Hooks need Node on your PATH. A failed sync leaves the Git update in place; fix the reported error and run `npm run sync`. Hooks do not remove links for deleted skills. To remove one, delete its links from the global skill folders.

## Change a skill

1. Edit `<name>/SKILL.md` on a branch and run `npm run sync` to try it.
2. Run `npm run eval` to compare `tldr` on `main` with your working copy. Set `RUNS=5` before trusting a difference. Each run costs about $0.10 per fixture and version.
3. Merge the PR, then on `main` run `npm run release`. It bumps the patch version in `package.json`, tags it `vX.Y.Z`, pushes the tag, and syncs.

The repo has one version for all skills. To see what changed in one skill, run `git log -- <name>/`.

To remove a skill, delete its folder and its links from the global skill folders listed in `scripts/sync-skills.mjs`.

### Evals

`evals/fixtures/*.md` each hold a `TASK:` line and a long agent response. `evals/checks.json` sets per-fixture limits and patterns. `evals/run.mjs` replays each response, runs `/tldr` from each version, checks the format, and has Sonnet judge whether the brief adds anything not in the response. Output goes to `evals/.work/`.

## Skill format

Follow the [Agent Skills spec](https://agentskills.io/specification): `name` matches the folder (lowercase, hyphens, up to 64 characters), and `description` is up to 1024 characters.

Manual-only skills set `disable-model-invocation: true`. Claude Code, Cursor, and Pi honor it. Codex reads `agents/openai.yaml` with `policy.allow_implicit_invocation: false` instead, so add both.

## Global instructions

CI fails a PR that adds more lines to `global/AGENTS.md` than it removes, unless the PR body has a line `Why more lines: <reason>`. Reworded lines count as one added and one removed, so they net to zero. The eval behind this (home ledger, skills diagnosis 2026-11-06) scored fewer rules higher. Run `scripts/agents-md-budget origin/main` on a branch to see the numbers before pushing.

`global/ENFORCERS.md` names what holds each hard rule in it: a hook, a CI check, a scheduled job, or prose with the reason or a finding. When a rule changes, update its row.

`global/AGENTS.md` is the one instruction file every harness reads; edit it here, not through the links. There is no shared global path: Codex, Pi, Grok and OpenCode each read `AGENTS.md` from their own home folder, and Claude Code only reads `~/.claude/CLAUDE.md`. Cursor stores user rules in its settings, not on disk (a marker in `~/.cursor/rules/*.mdc` never loaded), so sync cannot link it. Instead its User Rules hold one pointer line, set once and never stale: run `npm run cursor-rules`, which copies the line and prints the three clicks (Cursor Settings, Customize, Rules; paste into User Rules). A Cursor session given that line read this file and answered from it. Antigravity loads the skills but loaded no global rules file from `~/.gemini/GEMINI.md`, `AGENTS.md`, `config/GEMINI.md`, `config/AGENTS.md` or `config/rules/AGENTS.md`, so it has no global instructions yet.

## Agent helpers

`bin/` holds small commands that replace the `gh` and `git` pipelines agents kept rewriting: `pr-status`, `pr-wait`, `pr-threads`, `runq`, `bgjob`, `repo-state`, `disk-clean` and `ledger-comment` (comments on a home issue and adds the marker that tells an agent's comment from Peter's). Each prints a compact summary and has `--help`. `global/AGENTS.md` lists them, which is how agents learn they exist; shell aliases would not work, because agent shells drop them. Keep the output short, since every line lands in an agent's context.

`bin/turn-check` is not a command agents call: it is a Claude Code `Stop` hook, and sync registers its `~/.local/bin` link in the `settings.json` of every Claude Code config dir on the machine (`~/.claude`, any `~/.claude<n>` account, `$CLAUDE_CONFIG_DIR`). When an agent ends a turn while a harness background task is still running, or its last message promises to report later ("I'll check the files once it finishes") with no scheduled wakeup, the hook sends it back once with the reason: finish the job in the turn (`bgjob wait`), or hand it over with the command that checks it. A task blocks once per session (state in `~/.local/state/turn-check`), so a dev server left up costs one turn, not every turn. Sync rewrites `settings.json` with two-space indent and follows a symlink, so a dotfiles-tracked file is updated in place. Home ledger #40 holds the 16 events behind it. `tests/turn-check/run` replays the cases in `tests/turn-check/cases/` and runs in CI; add a case for every new false positive or miss.

`bin/scheduled-allow` is the second hook sync registers, on `PermissionRequest`. In a session whose first user message starts with `[t3-sentinel-run]`, the marker on every scheduled T3 prompt, it answers allow to each permission prompt, so a scheduled run never waits on Peter. Bypass mode still raises some prompts (`ssh-add -l` is one), and a `PreToolUse` allow does not stop them; a `PermissionRequest` allow does. Other sessions get no answer and keep their prompts, and `AskUserQuestion` and `ExitPlanMode` are left alone. The verdict holds for the whole session, so a reply typed later into a scheduled thread runs without prompts too. On the T3 SDK path the allowed call runs at once, but T3 still shows a stale approval card for it (home #84). `tests/scheduled-allow/run` runs in CI.

`bin/start-task` is the third, on `SessionStart` and `PreToolUse`, and also a command: Codex and Cursor have no hook from sync, so `global/AGENTS.md` tells them to run it first. At session start it prints the tracker for the folder (Linear under the work folder the home README's tracker rule names, compared as physical paths and counting a git worktree as its main checkout's folder; `peterpme/home` issues elsewhere), the command that searches it, and the Tiers table read from `global/AGENTS.md` (home #17). On `Edit`, `Write`, `MultiEdit`, `NotebookEdit` and in-place edits through Bash (`sed -i`, `perl -i`, `cat >`, `tee`; not ticket bodies or `.verification/`) it denies the first edit of a session that has not written its ticket (a `gh issue create`, `comment` or `edit`, a Linear issue or comment tool, or a ticket link in a user message), once per session; a link that only came back in search results does not count (home #93). Other shell writes are not gated. stdin is read with a one-second limit, since an agent shell can hold it open. `START_TASK_OFF=1` silences it. `tests/start-task/run` runs in CI.

`bin/tool-guard` is the fourth hook sync registers (home#105), a `PreToolUse` hook on Bash, Write, Edit and NotebookEdit: a Bash deploy command (`railway up`, `vercel --prod`, `wrangler deploy`, `fly deploy` and similar, at a command position, so a commit message that names one is quiet) gets a permission `ask`, never a deny, and a command or file path under `/tmp` gets a warning that never blocks. `bin/scheduled-allow` leaves a deploy prompt unanswered, so a scheduled run cannot deploy. `tests/tool-guard/run` runs in CI.

`bin/perf-claim <pr>` fails a PR that claims a speed, latency, memory or size gain without a before and after number, and `bin/pr-status` exits 9 for a tier 2 draft whose contract comment is under two hours old (home#105). The `orchestrate` ready gate runs both. `tests/perf-claim/run` and `tests/pr-status-hold/run` run in CI.

`bin/scheduled-models` lists the T3 scheduled tasks from the local T3 database and flags an enabled one on Fable, Grok or opencode, or a Worker off the `scheduled-worker` row of `global/models.tsv`; `bin/pr-dupes` lists open PRs that a newer PR says it supersedes. The chief of staff runs both daily (home#105). `tests/scheduled-models/run` and `tests/pr-dupes/run` run in CI.

Machine settings, including the zsh setup agents rely on, live in [dotfiles](https://github.com/peterpme/dotfiles), cloned at `~/dotfiles`.
