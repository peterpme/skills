# What enforces each rule in AGENTS.md

A prompt is a weak control; a tool, hook or check is a strong one. Each hard rule in `AGENTS.md` is listed here with what holds it. When an agent breaks a rule, first ask what tool would make the mistake impossible, then add it here before adding a sentence. A prose-only rule carries either the reason prose is enough or the finding issue in the home ledger that asks for a tool.

Kinds: **hook** (runs in the harness), **CI** (runs on the PR), **scheduled** (a daily or hourly job catches it after the fact), **helper** (a `bin/` command the agent has to call), **branch rule**, **setup** (the machine's install), **prose**.

| Rule | Enforcer | Kind | Gap or reason |
|---|---|---|---|
| Cut a rule when you add one (`AGENTS.md` may not grow) | `scripts/agents-md-budget`, required by the `main` ruleset | CI, branch rule | |
| Promise a later report only when something will wake you | `bin/turn-check` Stop hook, cases in `tests/turn-check/` | hook | |
| Remove a worktree once its branch is merged or abandoned; clean and report low disk to Chief of staff | `bin/disk-clean`, daily through `clean-disk`; `t3_thread_send` in queue mode | scheduled, helper, prose | Low-disk reporting is agent-driven (home#253) |
| Close your own PR when superseded or idle for 14 days | `chief-of-staff` daily run; its `bin/pr-dupes` lists every open PR whose newer sibling says "supersedes #n" | scheduled, helper | "Same turn" is not held: a superseded PR is caught the next morning, not in the turn |
| My corrections are collected weekly | The weekly `skill-scout` run reads the week's threads and records them with `bin/feedback`; agents no longer run `feedback add` each turn | scheduled | A correction made outside T3 Code is missed |
| Every review thread is resolved before draft ends and before handover | `bin/pr-threads` lists them | helper | No branch rule requires resolved threads |
| Worktrees and `.verification/` stay out of PRs | The global excludes file (`~/.gitignore`, from dotfiles) | setup | |
| `<!-- agent -->` ends every home comment | `bin/ledger-comment` adds it | helper | |
| Never deploy unless the task is the deploy | `bin/tool-guard` PreToolUse hook: a permission `ask` on `railway up`, `vercel` deploys, `wrangler deploy` and similar; `scheduled-allow` leaves that prompt unanswered | hook | An ask, never a deny, so a real deploy task still runs after a yes. Claude Code only: Codex and other harnesses are not covered. A deploy by another tool (a CI push, a dashboard) is out of reach |
| Coordinators leave tracked-file edits, commits and pushes to visible workers | `bin/coordinator-guard` PreToolUse hook in Claude Code and Codex | hook | Resolves T3 titles from the local thread database. Covers direct edit tools, Git commands and common shell writes. Arbitrary scripts and external mutation tools are outside its coverage. Codex requires one-time trust in `/hooks`. |
| Never `/tmp` | `bin/tool-guard` PreToolUse hook adds a warning to the agent's context for a `/tmp` command or file path | hook | Warns only, on purpose: reading a file someone left in `/tmp` is real work, so a block would stop it. Claude Code only. `/tmp/claude*`, the harness's own scratch, is skipped |
| A claim of faster or smaller carries the number before and after | `harness-first` skill: a committed baseline lands before the optimization PR | prose | Judgment; `bin/perf-claim` checked PR bodies until it was removed with `orchestrate` (home#367) |
| Never write secrets in home | `gitleaks` pre-commit hook in `peterpme/home` (`.githooks/pre-commit`, home#142), `scripts/test-hooks` there | hook | GitHub secret scanning is not available for a private personal repo (HTTP 422). Installed per clone with `scripts/install-hooks`; a machine without gitleaks gets a warning and the commit goes through. A push from the web UI is not scanned |
| Tier 2 review is findings with a failing command, never votes | none | prose | Decided in home#100 |
| Never merge in work repos | Work repos' branch rules | branch rule | Not checked from here |
| Commands Claude Code prompts on (`rsync`, `cd` before `git`, ...) | Claude Code's permission prompt | hook | The rule describes the harness, so the harness holds it |
| GNU `sed`, `grep`, `date` and `stat` | dotfiles `.zshenv` puts GNU tools first on PATH in every zsh, agent shells included | setup | A BSD-style flag fails loudly |
| Define done first; never say verified without checking | none | prose | Judgment. A false "verified" is a postmortem trigger in the home ledger, so a miss gets a tool |
| Use what exists | `delegate` library field, `ci-balance-delegate` replay, `coordinator` draft review | eval, review | Reviewer identifies functionality already in libraries |
| No feature flag, dev-only gate or second version unless the task asks for a flag | none | prose | Peter rejected a flag on 11-19, 11-21, 11-22 and 11-24 (home#324, home#367); a repo rule that asks for flags (wallet `AGENTS.md`) is changed in that repo |
| Ask only what only Peter knows, and keep working on the rest | none | prose | Judgment; the eval scores needed against routine questions |
| Lead with the answer, in the `tldr` shape | `npm run eval` scores the shape | prose | Style; the eval catches drift in the skill, not in one reply |
| State lives in the ledger | `chief-of-staff` reads every epic daily | scheduled | A missing event shows as a stale epic |
| Run or dry-run a command before handing it to Peter | none | prose | Judgment; Peter sees the failure at once |
| Pull home before inspecting or changing it | none | prose | A stale clone fails at push |
| No scheduled task runs Fable; the Worker task runs the `scheduled-worker` row of `global/models.tsv` | `bin/scheduled-models`, run by the `chief-of-staff` daily run, flags an enabled task on Fable, Grok or opencode, on a model missing from the table, or a Worker off the table | scheduled | Caught at the next morning's run, not when the task is saved. Reads the laptop's T3 database only |
