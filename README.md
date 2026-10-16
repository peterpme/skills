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

1. Edit `<name>/SKILL.md`.
2. Commit, then run `npm run release`. It bumps the version, tags the commit, and syncs.

To remove a skill, delete its folder and run `npx skills remove <name> --global`.

## Skill format

Follow the [Agent Skills spec](https://agentskills.io/specification): `name` matches the folder (lowercase, hyphens, up to 64 characters), and `description` is up to 1024 characters.

Manual-only skills set `disable-model-invocation: true`. Claude Code, Cursor, and Pi honor it. Codex reads `agents/openai.yaml` with `policy.allow_implicit_invocation: false` instead, so add both.

Machine settings and global instructions live in [dotfiles](https://github.com/peterpme/dotfiles), cloned at `~/dotfiles`.
