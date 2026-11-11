# What enforces each rule in AGENTS.md

A prompt is a weak control; a tool, hook or check is a strong one. Each hard rule in `AGENTS.md` is listed here with what holds it. When an agent breaks a rule, first ask what tool would make the mistake impossible, then add it here before adding a sentence. A prose-only rule carries either the reason prose is enough or the finding issue in the home ledger that asks for a tool.

Kinds: **hook** (runs in the harness), **CI** (runs on the PR), **scheduled** (a daily or hourly job catches it after the fact), **helper** (a `bin/` command the agent has to call), **branch rule**, **setup** (the machine's install), **prose**.

| Rule | Enforcer | Kind | Gap or reason |
|---|---|---|---|
| Cut a rule when you add one (`AGENTS.md` may not grow) | `scripts/agents-md-budget`, required by the `main` ruleset | CI, branch rule | |
| Promise a later report only when something will wake you | `bin/turn-check` Stop hook, cases in `tests/turn-check/` | hook | |
| Remove a worktree once its branch is merged or abandoned | `bin/disk-clean`, daily through `clean-disk` | scheduled | |
| Close your own PR when superseded or idle for 14 days | `chief-of-staff` daily run | scheduled | "Same turn" for a superseded PR is prose: home#105 |
| Feedback goes in with `feedback add` the same turn | `bin/feedback`; `skill-scout` daily adds what was missed | helper, scheduled | |
| Every review thread is resolved before draft ends and before handover | `bin/pr-status`, `bin/pr-threads`, called by the `orchestrate` ready gate | helper | No branch rule requires resolved threads; the gate's checklist is the control |
| Worktrees and `.verification/` stay out of PRs | The global excludes file (`~/.gitignore`, from dotfiles) | setup | |
| PRs under 400 hand-written lines | `bin/pr-status` (exit 3 over the cap without an `Unsplittable:` body line), called by the `orchestrate` ready gate | helper | Not a CI check; the gate runs it. Counts exclude lockfiles and generated paths |
| `<!-- agent -->` ends every home comment | `bin/ledger-comment` adds it | helper | |
| Never deploy unless the task is the deploy | `bin/tool-guard` PreToolUse hook: a permission `ask` on `railway up`, `vercel` deploys, `wrangler deploy` and similar; `scheduled-allow` leaves that prompt unanswered | hook | An ask, never a deny, so a real deploy task still runs after a yes. Claude Code only: Codex and other harnesses are not covered. A deploy by another tool (a CI push, a dashboard) is out of reach |
| Tier 2 PR stays a draft two hours after the contract | none | prose | home#105 |
| Never `/tmp` | `bin/tool-guard` PreToolUse hook adds a warning to the agent's context for a `/tmp` command or file path | hook | Warns only, on purpose: reading a file someone left in `/tmp` is real work, so a block would stop it. Claude Code only. `/tmp/claude*`, the harness's own scratch, is skipped |
| Measure, change, measure | `harness-first` skill: a committed baseline lands before the optimization PR | prose | Planning is scored by the orchestrate eval perf cases; no check yet that a PR carries both numbers: home#105 |
| Never write secrets in home | `gitleaks` pre-commit hook in `peterpme/home` (`.githooks/pre-commit`, home#142), `scripts/test-hooks` there | hook | GitHub secret scanning is not available for a private personal repo (HTTP 422). Installed per clone with `scripts/install-hooks`; a machine without gitleaks gets a warning and the commit goes through. A push from the web UI is not scanned |
| Tier 2 review is findings with a failing command, never votes | `orchestrate` step 5 | prose | Decided in home#100 |
| Never merge in work repos | Work repos' branch rules | branch rule | Not checked from here |
| Commands Claude Code prompts on (`rsync`, `cd` before `git`, ...) | Claude Code's permission prompt | hook | The rule describes the harness, so the harness holds it |
| GNU `sed`, `grep`, `date` and `stat` | dotfiles `.zshenv` puts GNU tools first on PATH in every zsh, agent shells included | setup | A BSD-style flag fails loudly |
| Define done first; never say verified without checking | `orchestrate` proof table and ready gate | prose | Judgment. A false "verified" is a postmortem trigger in the home ledger, so a miss gets a tool |
| Contract before code; tier written on the ticket | `orchestrate` step 1; the Worker reads the tier from the ticket | prose | Judgment about content; a missing contract shows on the ticket |
| Use what exists; no one-off script in a PR | `research-first` prior-art note before new tooling; diff review | prose | Judgment; a missing note shows in the plan and the contract |
| Decide, log, proceed; ask only when the readings diverge | none | prose | Judgment; no tool can tell a reversible call from an irreversible one |
| Report like a VP, in the `tldr` shape | `npm run eval` scores the shape | prose | Style; the eval catches drift in the skill, not in one reply |
| State lives in the ledger | `chief-of-staff` reads every epic daily | scheduled | A missing event shows as a stale epic |
| Run or dry-run a command before handing it to Peter | none | prose | Judgment; Peter sees the failure at once |
| Pull home before inspecting or changing it | none | prose | A stale clone fails at push |
| Grok and `opencode` are never used, through any provider (`delegate` table) | `bin/model-guard` PreToolUse hook denies a T3 tool call (`delegate_task`, `schedule_task`, thread launch) whose model or provider field names either | hook | Claude Code only; reads the model and provider fields, not the brief. A Grok run started outside T3 (a shell command) is not seen |
