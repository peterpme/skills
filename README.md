# Skills

Personal agent skills. One folder per skill at the repository root.

- [tldr](tldr/SKILL.md): Cut the last response down to a one-sentence summary, your decisions, and what is next.
- [tldr-go](tldr-go/SKILL.md): Approve the last `/tldr` picks and have the agent do its next steps. Pass overrides like `/tldr-go 1 no, 2 B`.
- [word-this](word-this/SKILL.md): Make a draft coherent while preserving your voice, casing, and prose. Invoke explicitly; automatic invocation is disabled.
- [trace](trace/SKILL.md): Answer feature questions using the repository's docs and code. Invoke `$trace how does … work?`; automatic invocation is disabled.
- [ticket](ticket/SKILL.md): One line from Peter becomes one well-formed ledger issue (home or Linear) or a decision issue, filed by a cheap model.
- [chief-of-staff](chief-of-staff/SKILL.md): Daily run that keeps every stream moving: applies the merge and 14-day rules, closes or parks stale work and writes its learnings, posts one brief with only the decisions no rule covers.
- [finish-task](finish-task/SKILL.md): Carry a project change through real-flow proof, required checks and a draft PR. `global/AGENTS.md` makes every harness load it.
- [delegate](delegate/SKILL.md): Delegate investigations, tickets and reviews with model and effort routing, self-contained briefs and stall checks.
- [orchestrate](orchestrate/SKILL.md): Build without Peter steering: a contract (his decisions, acceptance checks, slices, defaulted questions) reviewed once by the other model family, workers build, Sol and Fable review each diff, and only PRs that pass the ready gate reach him. `evals/orchestrate/` replays real tasks to score it.
- [skill-review](skill-review/SKILL.md): Weekly: turns filed findings into one scored change and merges it when the replay eval says it helps; proposes cuts.
- [t3-loadbalancer](t3-loadbalancer/SKILL.md): Move running T3 Code threads between Claude accounts and Cursor as 5-hour usage runs low or recovers.
- [effect-v4](effect-v4/SKILL.md): Effect v4 reference for writing, reviewing and testing Effect TypeScript code.
- [new-repo](new-repo/SKILL.md): Create or standardize a GitHub repo: branch ruleset with one required `ci` check, cached Rust (BeautifulRust lints) or TypeScript (Vite+, tsrs) CI, Dependabot, and Railway deploys gated on CI. `scripts/github-setup` applies the settings.
- [clean-disk](clean-disk/SKILL.md): Daily on each machine, free disk space from merged or idle agent worktrees, stale Rust `target/` folders, build folders (through Mole), replaced simulator runtimes and oversized caches. `bin/disk-clean` holds the rules and backs up uncommitted changes first.
- [skill-scout](skill-scout/SKILL.md): Daily read of this machine's T3 threads; recurring friction becomes finding issues in the private home ledger, never an open PR.

The repo also holds the global agent instructions (`global/AGENTS.md`) and agent helper commands (`bin/`).

## Install

```bash
git clone https://github.com/peterpme/skills.git ~/skills
cd ~/skills && npm run setup
```

`npm run setup` installs this checkout's Git hooks and symlinks each skill into the global skill folder of every harness: Claude Code (`~/.claude/skills`), Codex (`~/.codex/skills`), Cursor (`~/.cursor/skills`), Grok (`~/.grok/skills`), Pi (`~/.pi/agent/skills`), Antigravity (`~/.gemini/config/skills`) and the shared `~/.agents/skills`. OpenCode reads `~/.claude/skills` and `~/.agents/skills`. It also links skills for OpenCode, GitHub Copilot, Droid, Gemini CLI and Windsurf when that harness's home folder exists. It links each `bin/` command into `~/.local/bin`, and `global/AGENTS.md` as `~/.codex/AGENTS.md`, `~/.pi/agent/AGENTS.md`, `~/.grok/AGENTS.md` and `~/.claude/CLAUDE.md`. Setup also installs a job that runs `git pull --ff-only` every 30 minutes: a launchd agent on macOS, a systemd user timer on Linux. Its log is `~/.local/state/personal-skills/pull.log`. Run setup once per clone; no dependencies need installing.

`npm run list` shows what the [`skills` CLI](https://github.com/vercel-labs/skills) sees in the global folders. Sync does not use that CLI to install: it copies each skill into `~/.agents/skills` instead of linking the checkout, so edits would stop being live, and it has no support for the global instructions file or `bin/`. Its agent folder table (`docs/agents.md`) is where to look when adding a harness: add the folder to `destinations` or `optional` in `scripts/sync-skills.mjs`.

Edits are live through the symlinks. A merged PR reaches every machine within 30 minutes. `git pull` automatically links new skills after a merge or rebase. Run `npm run sync` to sync manually. If a destination already contains a different folder or link, sync moves it to `~/.local/state/personal-skills/backups/` before linking; it does not delete those files.

Hooks need Node on your PATH. A failed sync leaves the Git update in place; fix the reported error and run `npm run sync`. Hooks do not remove links for deleted skills. To remove one, delete its links from the global skill folders.

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

`global/AGENTS.md` is the one instruction file every harness reads; edit it here, not through the links. There is no shared global path: Codex, Pi, Grok and OpenCode each read `AGENTS.md` from their own home folder, and Claude Code only reads `~/.claude/CLAUDE.md`. Cursor stores user rules in its settings, not on disk (a marker in `~/.cursor/rules/*.mdc` never loaded), so sync cannot link it. Instead its User Rules hold one pointer line, set once and never stale: run `npm run cursor-rules`, which copies the line and prints the three clicks (Cursor Settings, Customize, Rules; paste into User Rules). A Cursor session given that line read this file and answered from it. Antigravity loads the skills but loaded no global rules file from `~/.gemini/GEMINI.md`, `AGENTS.md`, `config/GEMINI.md`, `config/AGENTS.md` or `config/rules/AGENTS.md`, so it has no global instructions yet.

## Agent helpers

`bin/` holds small commands that replace the `gh` and `git` pipelines agents kept rewriting: `pr-status`, `pr-wait`, `pr-threads`, `runq`, `bgjob`, `repo-state` and `disk-clean`. Each prints a compact summary and has `--help`. `global/AGENTS.md` lists them, which is how agents learn they exist; shell aliases would not work, because agent shells drop them. Keep the output short, since every line lands in an agent's context.

Machine settings, including the zsh setup agents rely on, live in [dotfiles](https://github.com/peterpme/dotfiles), cloned at `~/dotfiles`.
