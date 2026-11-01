---
name: clean-disk
description: Free disk space on Peter's machines with `disk-clean`, which removes dead or idle agent git worktrees (T3 Code, Claude, Codex, Cursor), Rust target folders not built in a week, idle Xcode DerivedData and old trash-cli items, and prunes pnpm and uv caches. Use for the scheduled Disk cleanup run, when a machine is low on disk space, when asked to delete stale worktrees or cargo targets, or when asked to set up daily disk cleanup on a machine.
---

# Clean disk

Goal: no machine runs out of disk because of agent leftovers, and Peter never has to ask. One run is `disk-clean --apply`, then a short report.

`disk-clean` (in `~/skills/bin`, on PATH after `npm run sync`) holds every deletion rule. Run `disk-clean --help` for them. Do not delete things by hand that the script would not delete. In particular:

- Never remove a main checkout, delete a branch, or touch `~/Downloads`, `~/Documents`, Photos or the Finder trash (`~/.Trash`).
- Never `rm -rf` a worktree. The script uses `git worktree remove`, saves uncommitted changes first, and keeps the branch.
- Do not run `mo clean` (Mole). It hung for over 10 minutes on the laptop.
- `~/Library/Developer/CoreDevice/DeviceFS` is a mounted view of a connected iPhone, not local data. Ignore its size.
- Put `gtimeout 120` on any `du` you run yourself.

## Run

1. Run `disk-clean --apply`. It prints each removal with its reason and size, then the free space before and after. When Peter asks interactively, apply right away too: everything it removes can be regenerated or is backed up.
2. If anything is `FAILED`, read the reason. Fix it only if the fix is clearly safe, such as a stale `index.lock` with no git process running. Otherwise report it.
3. If free space is still under 100 GB or 15% of the disk, measure the next biggest items with `gtimeout 120 du -sh` on these, and report the top ones with the exact command that would free each:

   | Item | Command |
   |---|---|
   | `node_modules` in a main checkout not touched for 30+ days | `rm -rf <repo>/node_modules` (reinstall later) |
   | `~/.cache/uv` | `uv cache clean` |
   | `~/Library/pnpm` | `pnpm store prune` already ran; the rest is in use |
   | `~/Library/Developer/CoreSimulator` | `xcrun simctl delete <udid>` for simulators no longer needed |
   | `~/.gradle/caches` | `rm -rf ~/.gradle/caches` |
   | Docker | `docker system prune` |
   | `~/.Trash` | Empty Trash in Finder |
   | `~/.rustup/toolchains` | `rustup toolchain uninstall <old nightly>` |

   Do not run these yourself. They are Peter's call.

## Worktree rules

The script only touches worktrees under agent paths: `~/.t3/worktrees`, `<repo>/.claude/worktrees`, `~/.codex/worktrees`, `.codex-worktrees` and `~/.cursor/worktrees`. Sibling clones such as `~/Projects/x/repo-feature` are left alone.

- **Kept:** the tree is locked, a process is running in it, its branch has an open PR, or its T3 thread is still open and the tree isn't dead.
- **Dead:** the branch's PR is merged or closed, the T3 thread is deleted or archived, or the tree has no tracked edits and HEAD is already in the default branch. A dead tree is removed once it has been idle for a day.
- **Idle:** other trees are removed after 3 days idle. Trees with tracked edits wait 14 days and show as `watch` until then.
- **Backups:** before a tree with uncommitted changes is removed, the changes are saved to `~/.local/state/disk-clean/backups/<date>-<repo>-<tree>/` and kept 60 days. A detached commit that no branch holds is saved on a `rescued/<tree>-<sha>` branch.

To restore one, follow `README.txt` in its backup folder: `git worktree add <dir> <branch>`, then `git -C <dir> apply --index changes.patch` and `tar -xzf untracked.tar.gz -C <dir>`. To keep a tree out of cleanup, `git worktree lock <path>`.

If repos live outside `~/Projects`, `~/skills` and `~/dotfiles`, pass each extra directory with `--root <dir>`, or set `DISK_CLEAN_ROOTS` (colon-separated).

## Report

Lead with the answer:

```
**Disk cleanup, <machine>, <date>:** freed <N> GB, <free> GB free (<pct>% of disk).

| Removed | Count | Size |
|---|---|---|
| Worktrees (dead or idle) | | |
| Rust target folders | | |
| DerivedData, trash, caches | | |

Backed up before removal: <tree → backup folder, or none>
Watch: <trees with tracked edits that will be removed at 14 days, with idle days, or none>
Needs your call: <FAILED items, or the biggest remaining items with commands when free space is low, or none>
```

When nothing was removed and free space is fine, report one line.

## Set up on a machine

Every machine with T3 Code gets its own daily run, because the cleanup is local.

1. Confirm `disk-clean --help` works. If it doesn't, run `git -C ~/skills pull --ff-only && npm --prefix ~/skills run sync`.
2. Run `disk-clean` (a dry run) and check that the removals make sense for this machine. Add `--root` dirs if repos live elsewhere.
3. Call `schedule_task` with:
   - `projectId`: the "No project" (scratch) project from `t3_project_list`;
   - `bindToCurrentThread: false`;
   - `title: "Disk cleanup"`;
   - `schedule: {type: "fixed_time", timeOfDay: "07:00"}`;
   - this prompt, with any `--root` arguments added:

     > Run the clean-disk skill: one scheduled `disk-clean --apply` run on this machine, then the report. If `disk-clean` is not on PATH, say so in one line and stop.

4. Report the next run time.
