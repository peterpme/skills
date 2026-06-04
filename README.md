# peterpme/skills

My collection of agent skills (slash commands and behaviors) for Claude Code.

## Install

### As a Claude Code plugin

Install from this repo via the Claude Code plugin marketplace.

### Locally (symlink for development)

```bash
git clone git@github.com:peterpme/skills.git ~/projects/skills
bash ~/projects/skills/scripts/link-skills.sh
```

This symlinks every `SKILL.md`-bearing directory under `skills/` (excluding `deprecated/`) into `~/.claude/skills/`.

## Reference

### Engineering

Skills for daily code work.

- **[engineering-manager](./skills/engineering/engineering-manager/SKILL.md)** — Coordinate complex engineering work with specialist agents or human reviewers, validation gates, PR handling, and final independent audits.
- **[continuity](./skills/engineering/continuity/SKILL.md)** — Learn, record, audit, and apply codebase patterns consistently across a repository.
- **[composition-first-refactor](./skills/engineering/composition-first-refactor/SKILL.md)** — Review a focused React or React Native refactor, sketch data flow and component tree, then wait for approval before coding.

### Productivity

General workflow tools, not code-specific.

- **[morning-recap](./skills/productivity/morning-recap/SKILL.md)** — Summarize PRs merged in a GitHub repo over the last N hours, excluding ones you've touched, and rank what's worth reviewing.
- **[study-repo](./skills/productivity/study-repo/SKILL.md)** — Clone a GitHub repo and set up an interactive study session for reading and analyzing the codebase.

### Misc

Tools kept around but rarely used.

_(none yet)_

## Layout

```
skills/
├── engineering/    # daily code work        (shippable)
├── productivity/   # daily non-code         (shippable)
├── misc/           # rare-use tools         (shippable)
├── personal/       # tied to my own setup   (not promoted)
├── in-progress/    # drafts                 (not promoted)
└── deprecated/     # no longer used         (not linked)
```

Skills in `engineering/`, `productivity/`, and `misc/` are listed in this README and in `.claude-plugin/plugin.json`. The other buckets are not.
