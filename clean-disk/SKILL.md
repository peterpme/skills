---
name: clean-disk
description: Free disk space on Peter's machines with `disk-clean`, which removes merged or idle agent git worktrees (T3 Code, Claude, Codex, Cursor), Rust target folders not built in a week, build folders through Mole's `mo purge`, idle or orphaned Xcode DerivedData, replaced simulator runtimes and old trash-cli items, and empties uv, Gradle, Yarn and npm caches that pass a size cap. Use for the scheduled Disk cleanup run, when a machine is low on disk space, when asked to delete stale worktrees or cargo targets, or when asked to set up daily disk cleanup on a machine.
compatibility: macOS or Linux with git, gh and python3. Uses Mole (`mo`) and Xcode's `simctl` when installed. Reads T3 Code's local database when present.
---

# Clean disk

Goal: no machine runs out of disk because of agent leftovers, and Peter never has to ask. One run is `disk-clean --apply`, then a short report.

`disk-clean` (`scripts/disk-clean` in this skill, linked onto PATH as `disk-clean` by `npm run sync`) holds every deletion rule. Run `disk-clean --help` for them. Do not delete things by hand that the script would not delete. In particular:

- Never remove a main checkout, delete a branch, or touch `~/Downloads`, `~/Documents`, Photos or the Finder trash (`~/.Trash`).
- Never `rm -rf` a worktree. The script uses `git worktree remove`, saves uncommitted changes first, and keeps the branch.
- Do not run `mo clean` (Mole). It stops at its developer-tools step (after Corepack) and never finishes; seen twice on the laptop on 2026-11-06, with and without uv whitelisted. `disk-clean` runs `mo purge --yes`, which finishes in about a minute.
- `~/Library/Developer/CoreDevice/DeviceFS` is a mounted view of a connected iPhone, not local data. Ignore its size.
- Put `gtimeout 120` on any `du` you run yourself.

## Run

1. Run `disk-clean --apply`. It prints each removal with its reason and size, then the free space before and after. When Peter asks interactively, apply right away too: everything it removes can be regenerated or is backed up.
2. If anything is `FAILED`, read the reason. Fix it only if the fix is clearly safe, such as a stale `index.lock` with no git process running. Otherwise report it.
3. If free space is still under 100 GB or 15% of the disk, measure the next biggest items with `gtimeout 120 du -sh` on these, and report the top ones with the exact command that would free each:

   | Item | Command |
   |---|---|
   | `node_modules` in a main checkout not touched for 30+ days | `rm -rf <repo>/node_modules` (reinstall later) |
   | `~/Library/pnpm` | `pnpm store prune` already ran; the rest is in use |
   | `~/Library/Developer/CoreSimulator/Devices` | `xcrun simctl delete <udid>` for simulators no longer needed |
   | `~/.android/avd` | delete AVDs no longer needed in Android Studio's Device Manager |
   | Docker | `docker system prune` |
   | `~/.Trash` | Empty Trash in Finder |
   | `~/.rustup/toolchains` | `rustup toolchain uninstall <old nightly>` |

   Do not run these yourself. They are Peter's call.

## Worktree rules

The script only touches worktrees under agent paths: `~/.t3/worktrees`, `<repo>/.claude/worktrees`, `~/.codex/worktrees`, `.codex-worktrees` and `~/.cursor/worktrees`. Sibling clones such as `~/Projects/x/repo-feature` are left alone.

A tree is removed once it has been idle long enough for its kind. Idle time counts from the newest of: a file edit in the tree, a commit, checkout or reset (the last reflog entry), and activity in its T3 thread. The index file's timestamp is not used, because background `git status` calls refresh it.

| Kind | Removed after | Meaning |
|---|---|---|
| Merged | 1 idle day | The branch's PR is merged or closed, the T3 thread is deleted or archived, or (with no tracked edits) every commit is already in origin's default branch or a `production`, `release/*`, `stable` or `<app>-production-<version>` branch. Squash and rebase merges count. |
| Clean | 3 idle days (`--days`) | No uncommitted or untracked files. Removing it loses nothing because the branch stays, so an open PR or open T3 thread doesn't keep it. |
| Dirty | 14 idle days | Shown as `watch` from day 3. Changes are backed up before removal. |

- **Never removed:** locked trees, and trees a process is running in.
- **Backups:** before a tree with uncommitted changes is removed, the changes are saved to `~/.local/state/disk-clean/backups/<date>-<repo>-<tree>/` and kept 60 days. A detached commit that no branch holds is saved on a `rescued/<tree>-<sha>` branch.

## Cache rules

| Item | Rule |
|---|---|
| Project build folders | `mo purge --yes`: Mole's purge of `build`, `dist`, `Pods`, `.venv` and similar in projects with no file changed in 7 days |
| Xcode DerivedData | Removed when its project folder is gone (such as a removed worktree) or it has been idle 7 days |
| trash-cli trash | Items deleted 3+ days ago |
| Simulator runtimes | Removed when unused for 14 days and a newer runtime of the same family exists (a device-specific runtime such as `iOS-27-2-iPhone19-4` is its own family) |
| Simulators | `xcrun simctl delete unavailable` |
| pnpm | `pnpm store prune` |
| uv | `uv cache prune`, waiting at most 60 s for uv's lock. A long-running `uvx` MCP server holds that lock; then archives older than 14 days are removed directly. |
| Size caps | Emptied when over the cap and not in use: uv 10 GB, Gradle 10 GB (skipped while a Gradle daemon runs), Yarn global cache 5 GB, npm 5 GB |

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
| Build folders (Mole), DerivedData, runtimes, trash, caches | | |

Backed up before removal: <tree → backup folder, or none>
Watch: <trees with tracked edits that will be removed at 14 days, with idle days, or none>
Needs your call: <FAILED items, or the biggest remaining items with commands when free space is low>
```

Write the `Needs your call:` line only when something there needs Peter; otherwise leave it out. When nothing was removed and free space is fine, report one line. Scheduled runs keep Peter's feed clean: where the machine has a cleanup for scheduled-run threads, a run thread is deleted a few minutes after it finishes unless its report has a `Needs your call:` line. `history.log` keeps the record.

## Set up on a machine

Every machine with T3 Code gets its own daily run, because the cleanup is local.

1. Confirm `disk-clean --help` works. If it doesn't, run `git -C ~/skills pull --ff-only && npm --prefix ~/skills run sync`. If it still doesn't, this skill isn't merged to `main` yet: stop, because every scheduled run would fail.
2. Run `disk-clean` (a dry run) and check that the removals make sense for this machine. Add `--root` dirs if repos live elsewhere.
3. Call `schedule_task` with:
   - `projectId`: the "No project" (scratch) project from `t3_project_list`;
   - `bindToCurrentThread: false`;
   - `title: "Disk cleanup"`;
   - `schedule: {type: "fixed_time", timeOfDay: "07:00"}`;
   - this prompt, with any `--root` arguments added:

     > [t3-sentinel-run] Run the clean-disk skill: one scheduled `disk-clean --apply` run on this machine, then the report. If `disk-clean` is not on PATH, reply in one line starting with "Needs your call:" that the skill isn't installed, and stop.

4. If `~/.t3/sentinel/config.json` exists, add the returned `scheduledTaskId` to its `cleanup_task_ids` list, so finished run threads are deleted. The `[t3-sentinel-run]` tag keeps the watchdog from treating the run as agent work.
5. Report the next run time.
