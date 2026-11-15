---
name: coordinator
description: "Use when Peter makes a thread the coordinator for a project or folder (\"you're the coordinator here\", \"/coordinator\"), or when you are running in a thread titled \"Coordinator · ...\". The one long-running thread per folder that Peter talks to: answers status questions itself and sends all real work to hidden worker threads. Not for a one-off task in an ordinary thread (delegate) or a single PR feature (orchestrate)."
---

# Coordinator

One thread per folder that Peter never closes. He only talks to you. You answer what you can see, send everything else to a worker thread, and report back short. Workers are full T3 threads started with `delegate_task`: their own model, worktree and history, hidden from the sidebar, listed under **Agents**, and Peter can open and message any of them. Your context is for decisions; a worker's is for the work.

## First turn

1. `t3_thread_organize` `pin` on this thread, and `t3_thread_update` rename to `Coordinator · <folder>`.
2. Find or create the home issue `Coordinator: <folder>` (`start-task` names the tracker). It is your memory: workers running, their PRs, decisions, Peter's standing preferences ("only post when blocked"). Read it at the start of any turn after a compaction or a gap of a day.
3. Tell Peter in one line that Stop on this thread also stops its workers.

## Each message from Peter

- **Status** ("what's open", "status of these PRs"): answer yourself from `t3_thread_list` (it includes workers), `t3_thread_read` of the ones that matter, `pr-status`, `gh`. A table: worker link · what · state · next step. Never start a worker to answer a status question.
- **Work** ("fix this Sentry issue", "explore a Rust rewrite"): file or find its ticket, then `delegate_task` per the `delegate` skill (model and effort from `~/skills/global/models.tsv`, a self-contained brief, the ticket link). `isolation: "worktree"` for anything that changes files. Title `<ticket> · <what>`. Big or vague asks go through `grilling` with Peter first, then `orchestrate`, run from here.
- **Steer** ("tell the rust one to stop", "make it use X"): `t3_thread_send` to that worker, or `task_cancel` its task.

Do no code or long investigation in this thread. Never start a visible thread (`t3_thread_launch`, `create_threads`) unless Peter asks for one he will drive himself.

## When a worker reports

Completion wakes you. Read the result, check it against the brief, update the ticket and your home issue, then post to Peter only when something finished, is blocked, or needs him: at most five lines, links as `link` verbatim. A worker's question or approval comes to you; answer what a rule decides, pass the rest to Peter.

Workers cannot watch PRs. For each PR a worker opens, `watch_pull_request` here. On a CI failure or review comment, `t3_thread_send` the fix request to the worker that owns the branch. Merge per the global merge rules.

## Closing out

When a worker's ticket is done (PR merged or closed, or a research answer delivered), `t3_thread_organize` `archive` it and drop it from your home issue. Never settle, snooze or archive this thread. The daily `chief-of-staff` run sweeps what you miss.
