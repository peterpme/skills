# What enforces each rule in AGENTS.md

A prompt is a weak control; a tool, hook or check is a strong one. Each hard rule in `AGENTS.md` is listed here with what holds it. When an agent breaks a rule, first ask what tool would make the mistake impossible, then add it here before adding a sentence. A prose-only rule carries either the reason prose is enough or the finding issue in the home ledger that asks for a tool.

Kinds: **hook** (runs in the harness), **CI** (runs on the PR), **scheduled** (a daily or hourly job catches it after the fact), **helper** (a `bin/` command the agent has to call), **branch rule**, **setup** (the machine's install), **prose**.

| Rule | Enforcer | Kind | Gap or reason |
|---|---|---|---|
| Cut a rule when you add one (`AGENTS.md` may not grow) | `scripts/agents-md-budget` | CI | Not required by a branch rule, so a red PR can merge: home#101 |
| Promise a later report only when something will wake you | `bin/turn-check` Stop hook, cases in `tests/turn-check/` | hook | |
| Remove a worktree once its branch is merged or abandoned | `bin/disk-clean`, daily through `clean-disk` | scheduled | |
| Close your own PR when superseded or idle for 14 days | `chief-of-staff` daily run | scheduled | "Same turn" for a superseded PR is prose: home#105 |
| Feedback goes in with `feedback add` the same turn | `bin/feedback`; `skill-scout` daily adds what was missed | helper, scheduled | |
| Every review thread is resolved before draft ends and before handover | `bin/pr-status`, `bin/pr-threads`, called by the `orchestrate` ready gate | helper | No branch rule requires resolved threads; the gate's checklist is the control |
| Worktrees and `.verification/` stay out of PRs | Each repo's `.gitignore` | prose | Not in the global excludes file: home#102 |
| PRs under 400 hand-written lines | none | prose | home#103 |
| `<!-- agent -->` ends every home comment | none | prose | home#104 |
| Never deploy unless the task is the deploy | none | prose | home#105 |
| Tier 2 PR stays a draft two hours after the contract | none | prose | home#105 |
| Never `/tmp` | none | prose | home#105 |
| Measure, change, measure | `harness-first` skill: a committed baseline lands before the optimization PR | prose | Planning is scored by the orchestrate eval perf cases; no check yet that a PR carries both numbers: home#105 |
| Never write secrets in home | none | prose | home#105 |
| Tier 2 review is findings with a failing command, never votes | `orchestrate` step 5 | prose | Decided in home#100 |
| Never merge in work repos | Work repos' branch rules | branch rule | Not checked from here |
| Commands Claude Code prompts on (`rsync`, `cd` before `git`, ...) | Claude Code's permission prompt | hook | The rule describes the harness, so the harness holds it |
| GNU `sed`, `grep`, `date` and `stat` | dotfiles put GNU tools first on PATH | setup | A BSD-style flag fails loudly |
| Define done first; never say verified without checking | `orchestrate` proof table and ready gate | prose | Judgment. A false "verified" is a postmortem trigger in the home ledger, so a miss gets a tool |
| Contract before code; tier written on the ticket | `orchestrate` step 1; the Worker reads the tier from the ticket | prose | Judgment about content; a missing contract shows on the ticket |
| Use what exists; no one-off script in a PR | `research-first` prior-art note before new tooling; diff review | prose | Judgment; a missing note shows in the plan and the contract |
| Decide, log, proceed; ask only when the readings diverge | none | prose | Judgment; no tool can tell a reversible call from an irreversible one |
| Report like a VP, in the `tldr` shape | `npm run eval` scores the shape | prose | Style; the eval catches drift in the skill, not in one reply |
| State lives in the ledger | `chief-of-staff` reads every epic daily | scheduled | A missing event shows as a stale epic |
| Run or dry-run a command before handing it to Peter | none | prose | Judgment; Peter sees the failure at once |
| Pull home before inspecting or changing it | none | prose | A stale clone fails at push |
