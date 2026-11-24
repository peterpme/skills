---
name: clean-disk
description: "Use when a machine is low on disk space, when worktrees, Rust targets, build folders, Xcode DerivedData or caches should go (\"clean up disk\", \"close out their worktrees\"), for a "Disk low" alert, or to set hourly cleanup up on a machine. Runs `disk-clean`. Not for app bundle size, CI runner disk or personal files."
compatibility: macOS or Linux with git, gh and python3. Uses Mole (`mo`) and Xcode's `simctl` when installed. Reads T3 Code's local database when present.
---

# Clean disk

Goal: no machine runs out of disk because of agent leftovers, and Peter never has to ask. One run is `disk-clean --apply`, then a short report.

`disk-clean` (`scripts/disk-clean` in this skill, linked onto PATH as `disk-clean` by `npm run sync`) holds every deletion rule. Run `disk-clean --help` for them. Do not delete things by hand that the script would not delete. In particular:

- Never remove a main checkout, delete a branch, or touch `~/Downloads`, `~/Documents`, Photos or the Finder trash (`~/.Trash`).
- Never `rm -rf` a worktree. The script uses `git worktree remove`, saves uncommitted changes first, and keeps the branch.
- Do not run `mo clean` (Mole). It stops at its developer-tools step (after Corepack) and never finishes. `disk-clean` runs `mo purge --yes`, which finishes in about a minute.
- `~/Library/Developer/CoreDevice/DeviceFS` is a mounted view of a connected iPhone, not local data. Ignore its size.
- Put `gtimeout 120` on any `du` you run yourself.

## Run

The hourly job runs `disk-clean --apply --skip-if-free-over 100G` with no agent: above 100 GB free it ends in one line (`disk-clean SKIPPED: ...`, exit 0) without scanning. A manual run, or any run Peter asks for, leaves the flag off.

**Low disk.** The age rules below never touch a worktree used in the last day, so a day that makes forty of them fills the disk (255 GB on 2026-11-24, home#367). When free space is still under `--low-under` (100G) after the other passes, the last pass ignores age: in every kept agent worktree no process is running in, it deletes folders that can be rebuilt (`node_modules`, `Pods`, `DerivedData`, Gradle and Android build output, Rust `target/`, Xcode `Build`, also inside `.verification/`), biggest first, trees idle 2 hours or more first, until free space reaches `--free-target` (150G). Only folders git ignores that hold no tracked file. A thread that resumes there reinstalls; code, branches and proof files stay. It reads free space from the disk after each delete and ends after three deletes in a row that free nothing. Right before each delete it reads the running processes again. A hand edit inside a dependency folder is lost with it, so keep such a change in a tracked patch file. A folder holding a repository or worktree, and big ignored folders it does not recognise, are printed as `left`: report those, never delete them yourself without asking.

One `--apply` runs at a time per machine. While one runs it prints `disk-clean BUSY: another run in progress`, and within 15 minutes after one it prints `disk-clean RECENT: ran <N> min ago, <X> free`; both exit 0 having done nothing. Report that line and stop: the other run already cleaned.

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

The script only touches worktrees under agent paths: `~/.t3/worktrees`, `<repo>/.claude/worktrees`, `~/.codex/worktrees`, `.codex-worktrees` and . Sibling clones such as `~/Projects/x/repo-feature` are left alone.

A tree is removed once it has been idle long enough for its kind. Idle time counts from the newest of: a file edit in the tree, a commit, checkout or reset (the last reflog entry), and activity in its T3 thread.

| Kind | Removed after | Meaning |
|---|---|---|
| Merged | 1 idle day | The branch's PR is merged or closed, the T3 thread is deleted or archived, or (with no tracked edits) every commit is already in origin's default branch or a `production`, `release/*`, `stable` or `<app>-production-<version>` branch. Squash and rebase merges count. |
| Clean | 3 idle days (`--days`) | No uncommitted or untracked files. Removing it loses nothing because the branch stays, so an open PR or open T3 thread doesn't keep it. |
| Dirty | 14 idle days | Shown as `watch` from day 3. Changes are backed up before removal. |

- **`.verification/`:** in a tree that stays but has been idle past `--days`, the folder is removed. It is gitignored proof scratch, often full copies of Rust `target/` folders. In a tree in daily use, only the Rust `target/` copies inside it go (any folder with `CACHEDIR.TAG`, such as `target-head/` or `ws/bpx/target/`), once not built for 1 day; logs, screenshots and notes stay. The same rule covers `.verification/` in main checkouts such as `~/Projects/home`.
- **Never removed:** locked trees, and trees a process is running in. Idle time counts `git status` changes and `.verification/` writes, so a tree in use in the last day is never touched.
- **Backups:** before a tree with uncommitted changes is removed, the changes are saved to `~/.local/state/disk-clean/backups/<date>-<repo>-<tree>/` and kept 60 days. A detached commit that no branch holds is saved on a `rescued/<tree>-<sha>` branch.

Rust `target/` folders go after 7 days without a build. One over 40 GB goes after 1 hour without a build, unless a `cargo` or `rustc` process runs in its workspace or names it (one experiment target can fill the disk).

## Cache rules

| Item | Rule |
|---|---|
| Project build folders | `mo purge --yes`: Mole's purge of `build`, `dist`, `Pods`, `.venv` and similar in projects with no file changed in 7 days. It can hang, so it is stopped after 5 minutes and reported as `FAILED (timed out after 300 s, stopped)`. |
| Xcode DerivedData | Removed when its project folder is gone (such as a removed worktree) or it has been idle 7 days |
| trash-cli trash | Items deleted 3+ days ago |
| Simulator runtimes | Removed when unused for 14 days and a newer runtime of the same family exists (a device-specific runtime such as `iOS-27-2-iPhone19-4` is its own family) |
| Simulators | `xcrun simctl delete unavailable` |
| pnpm | `pnpm store prune` |
| uv | `uv cache prune`, waiting at most 60 s for uv's lock. A long-running `uvx` MCP server holds that lock; then archives older than 14 days are removed directly. |
| Size caps | Emptied when over the cap and not in use: uv 10 GB, Gradle 10 GB (skipped while a Gradle daemon runs), Yarn global cache 5 GB, npm 5 GB |
| npx installs (`~/.npm/_npx`) | Over the npm 5 GB cap, every install no running process uses is removed (npx fetches it again). `npm cache clean` does not touch them. |
| exact build caches (`~/.cache/exact/<kind>/<key>`) | Entries idle 7 days. exact's AGENTS.md: deleting them only costs the next first build its time. |

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

`disk-clean` ends with a `Peter decides (never deleted):` list sizing `~/.mtplx` (local LLMs), simulators and `~/.t3/scratch`. Put those in `Needs your call:` when free space is low; never delete them.

Write the `Needs your call:` line only when something there needs Peter; otherwise leave it out. When nothing was removed and free space is fine, report one line. Where the machine has a cleanup for scheduled-run threads, a run thread is deleted a few minutes after it finishes unless its report has a `Needs your call:` line. `history.log` keeps the record.

## Set up on a machine

Every machine gets its own hourly job, because the cleanup is local. No agent runs unless the disk stays low.

1. Confirm `disk-clean --help` works. If it doesn't, run `git -C ~/skills pull --ff-only && npm --prefix ~/skills run sync`.
2. Run `disk-clean` (a dry run) and check that the removals make sense for this machine. Add `--root` dirs or `DISK_CLEAN_ROOTS` if repos live elsewhere.
3. Install the job from dotfiles: `~/dotfiles/launchd/install.sh disk` (a LaunchAgent every 3600 s on macOS, a systemd user timer on Linux). It runs `~/dotfiles/launchd/disk-clean-hourly.sh`, which logs to `~/.local/state/dotfiles/disk.log`.
4. For the alert, call `schedule_task` with the "No project" (scratch) project, `bindToCurrentThread: false`, `title: "Disk low alert"`, `schedule: {type: "webhook", maxDeliveryAgeMinutes: 120}`, and a prompt that sends one line with `t3_thread_send` mode `"queue"` to the Chief of staff thread: host, `free_gb`, the three `top_kept` folders and what needs Peter, never deleting anything. Put the hook path (`/api/hooks/<task id>/<token>`) in `~/.t3/sentinel/config.json` as `disk_hook`, next to `port`. The token stays in that file, never in a repo.
5. When free space is still under 50 GB after a run, the job POSTs once; it sends again at most every 6 hours. Without `disk_hook` it only cleans and logs.
6. Check it: `~/dotfiles/launchd/install.sh status`.
