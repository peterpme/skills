---
name: coordinator
description: "Use when Peter makes a thread the coordinator for a project or folder (\"you're the coordinator here\", \"/coordinator\"), or in a thread titled \"Coordinator · ...\" or \"Chief of staff\". The permanent thread for decisions, status and small tasks. Launch bigger tasks as visible threads in the projects they touch."
---

# Coordinator

One permanent thread per folder for decisions and status. These rules apply to Chief of staff as well.

## First turn

1. Pin this thread with `t3_thread_organize` and name it `Coordinator · <folder>` with `t3_thread_update`. The home coordinator is `Chief of staff`.
2. Find or create `Coordinator: <folder>` in `peterpme/home`. Keep the PR table at the top and record standing preferences and decisions below it. Read that issue after a compaction or a day's gap.
3. Read the project's threads and refresh the PR table before reporting status.

## Each request

- **Small**. Do it inline without opening a ticket if it needs no branch, commit or PR, takes a few tool calls (about five minutes), and is reversible. Examples include a quick lookup, an issue label or comment, rerunning CI, marking a PR ready if the merge rules allow, or a local config tweak with a removal note. Repository file changes go to a worker.
- **Bigger**. Find or file the ticket and launch one visible top-level thread per task, titled `<ticket> · <what>`. Use `t3_project_list` to match the touched repo by its remote identity. Pass that project's ID explicitly as `projectId` to `t3_thread_launch`. For independent edits use `workspaceStrategy: {type: "worktree", baseRef: "origin/main", startFromOrigin: true}`, substituting the default branch. For dependent edits use their actual `baseRef` and set `startFromOrigin: false` for an unpublished base. Include the full ticket URL, scope, checks and a request to send progress, blockers, and results back to this coordinator with `t3_thread_send` in queue mode. Pick provider, model and effort from the worker row in `~/skills/global/models.tsv` using `modelSelection`. Give Peter the returned `link` verbatim.
- `create_threads` can batch top-level workers when they can share this checkout. For a different project or a separate worktree, use `t3_thread_launch`. A local `delegate_task` places a child under **Agents** and rejects a different `target.projectId`. If the destination project or launch is unavailable, report the blocker and keep the task out of the coordinator.
- **Steer**. Message the owning thread via `t3_thread_send`. Use the thread controls to stop it when asked.
- **Finish**. When a review or worker thread delivers its result and owns no open PR, settle it (top-level) or archive it (child) in that same turn with `t3_thread_organize`. A review is done once its verdict is on the PR or ticket.

## Open PRs

On every status read and worker event, list all of Peter's open PRs in the coordinator's repo or repos with live `gh` data. Match their URLs against T3 thread PR links in the owning projects and use the owning thread's returned `link`. If ownership cannot be confirmed, write `Unlinked`. Use whole days since GitHub's `updatedAt` for idle days. Report CI and review separately, including pending or no checks and draft or changes requested.

Replace the table at the top of the coordinator's issue, preserving the body below it. Leave an explicit empty state if no PRs are open. On a failed source read, preserve the last table and report the failure. Post changed rows in this thread.

| PR | What | CI | Reviews | Idle days | Owning thread | Next step |
| --- | --- | --- | --- | ---: | --- | --- |

Link and watch tracked open PRs in T3. Route failed checks and review findings to the owning thread and follow the global merge rules. On worker events, update the task ticket and check the result against the brief. When independent review is required, launch it visibly in the PR's project with the reviewer row in `models.tsv`, the head SHA, and the library-reuse question. Have an authorized non-author submit the review on that SHA and run `pr-status --reviewed` on that head before reporting completion. Post up to five lines when work finishes, is blocked or needs Peter.

## Chief of staff

Read the Morning brief, ledger and coordinator threads for cross-project status. Route work on skills, T3 Code and other repos straight to their projects. Use No project only for work that has no repo. The daily `chief-of-staff` skill handles idle-thread cleanup.
