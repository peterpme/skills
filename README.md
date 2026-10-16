# Skills

Personal agent skills. One folder per skill, directly at the repository root.

- [ceo](ceo/SKILL.md): Turn the current work into a short decision brief.

## Install

Requires Python 3.9 or newer.

```bash
git clone git@github.com:peterpme/skills.git ~/skills
python3 ~/skills/install.py
python3 ~/skills/install.py --check
```

The installer creates per-skill symlinks in:

- `~/.agents/skills`, the shared skill store used by Codex.
- `~/.claude/skills`.
- `~/.cursor/skills`.
- `~/.pi/agent/skills`.

Edits here are live through those links. Re-running the installer adds new skills and removes links to deleted skills from this repository. It preserves other installations and refuses to overwrite conflicting files or directories.

## Add or remove a skill

Add `<name>/SKILL.md` at the root, or delete its folder, then run `install.py` again. Keep names lowercase with hyphens. Put any supporting files inside that skill's folder.

Keep this list limited to skills you use. Removed skills remain in Git history.

Machine settings, agent extensions, and global instructions live in [dotfiles](https://github.com/peterpme/dotfiles), cloned separately at `~/dotfiles`.
