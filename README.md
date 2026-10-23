# Skills

Personal agent skills. One folder per skill at the repository root.

- [tldr](tldr/SKILL.md): Cut the last response down to a one-sentence summary, your decisions, and what is next.
- [tldr-go](tldr-go/SKILL.md): Approve the last `/tldr` picks and have the agent do its next steps. Pass overrides like `/tldr-go 1 no, 2 B`.
- [word-this](word-this/SKILL.md): Make a draft coherent while preserving your voice, casing, and prose. Invoke explicitly; automatic invocation is disabled.
- [trace](trace/SKILL.md): Answer feature questions using the repository's docs and code. Invoke `$trace how does … work?`; automatic invocation is disabled.
- [finish-task](finish-task/SKILL.md): Carry a project change through real-flow proof, required checks and a draft PR. `global/AGENTS.md` makes every harness load it.
- [delegate](delegate/SKILL.md): Delegate investigations, tickets and reviews with model and effort routing, self-contained briefs and stall checks.
- [t3-loadbalancer](t3-loadbalancer/SKILL.md): Move running T3 Code threads between Claude accounts and Cursor as 5-hour usage runs low or recovers.
- [effect-v4](effect-v4/SKILL.md): Effect v4 reference for writing, reviewing and testing Effect TypeScript code.

The repo also holds the global agent instructions (`global/AGENTS.md`) and agent helper commands (`bin/`).

## Install

```bash
git clone git@github.com:peterpme/skills.git ~/skills
cd ~/skills && npm run setup
```

`npm run setup` installs this checkout's Git hooks and symlinks each skill into the global skill folders for Claude Code, Codex, Cursor, Pi, and shared `.agents` discovery. It also links each `bin/` command into `~/.local/bin`, and `global/AGENTS.md` as `~/.codex/AGENTS.md`, `~/.pi/agent/AGENTS.md`, `~/.grok/AGENTS.md` and `~/.claude/CLAUDE.md`. Run setup once per clone; no dependencies need installing.

Edits are live through the symlinks. `git pull` automatically links new skills after a merge or rebase. Run `npm run sync` to sync manually. If a destination already contains a different folder or link, sync moves it to `~/.local/state/personal-skills/backups/` before linking; it does not delete those files.

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

`global/AGENTS.md` is the one instruction file every harness reads; edit it here, not through the links. There is no shared global path: Codex, Pi and Grok each read `AGENTS.md` from their own home folder, and Claude Code only reads `~/.claude/CLAUDE.md`. Grok truncates it at 10,000 characters. Cursor stores user rules in its settings, so paste changes to "Reporting results" there by hand.

## Agent helpers

`bin/` holds small commands that replace the `gh` and `git` pipelines agents kept rewriting: `pr-status`, `pr-wait`, `pr-threads`, `runq` and `repo-state`. Each prints a compact summary and has `--help`. `global/AGENTS.md` lists them, which is how agents learn they exist; shell aliases would not work, because agent shells drop them. Keep the output short, since every line lands in an agent's context.

Machine settings, including the zsh setup agents rely on, live in [dotfiles](https://github.com/peterpme/dotfiles), cloned at `~/dotfiles`.
