# Skills

Personal agent skills. One folder per skill at the repository root.

- [tldr](tldr/SKILL.md): Cut the last response down to a one-sentence summary, your decisions, and what is next.
- [tldr-go](tldr-go/SKILL.md): Approve the last `/tldr` picks and have the agent do its next steps. Pass overrides like `/tldr-go 1 no, 2 B`.

## Install

```bash
git clone git@github.com:peterpme/skills.git ~/skills
cd ~/skills && npm run sync
```

`npm run sync` uses Vercel's [`skills`](https://github.com/vercel-labs/skills) CLI. It copies each skill into `~/.agents/skills` (read by Codex, Cursor, and Pi) and links it into `~/.claude/skills`. It records each install in `~/.agents/.skill-lock.json`.

Edits are not live. Run `npm run sync` after changing a skill.

## Change a skill

1. Edit `<name>/SKILL.md` on a branch and run `npm run sync` to try it.
2. Run `npm run eval` to compare `tldr` on `main` with your working copy. Set `RUNS=5` before trusting a difference. Each run costs about $0.10 per fixture and version.
3. Merge the PR, then on `main` run `npm run release`. It bumps the patch version in `package.json`, tags it `vX.Y.Z`, pushes the tag, and syncs.

The repo has one version for all skills. To see what changed in one skill, run `git log -- <name>/`.

To remove a skill, delete its folder and run `npx skills remove <name> --global`.

### Evals

`evals/fixtures/*.md` each hold a `TASK:` line and a long agent response. `evals/checks.json` sets per-fixture limits and patterns. `evals/run.mjs` replays each response, runs `/tldr` from each version, checks the format, and has Sonnet judge whether the brief adds anything not in the response. Output goes to `evals/.work/`.

## Skill format

Follow the [Agent Skills spec](https://agentskills.io/specification): `name` matches the folder (lowercase, hyphens, up to 64 characters), and `description` is up to 1024 characters.

Manual-only skills set `disable-model-invocation: true`. Claude Code, Cursor, and Pi honor it. Codex reads `agents/openai.yaml` with `policy.allow_implicit_invocation: false` instead, so add both.

Machine settings and global instructions live in [dotfiles](https://github.com/peterpme/dotfiles), cloned at `~/dotfiles`.
