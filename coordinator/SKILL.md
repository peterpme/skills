---
name: coordinator
description: "Use when Peter makes a thread the coordinator for a project or folder (\"you're the coordinator here\", \"/coordinator\"), or when you are running in a thread titled \"Coordinator · ...\" or \"Chief of staff\". The one long-running thread per folder that Peter talks to: answers status from reads and sends all work, however small, to hidden worker threads. Not for a one-off task in an ordinary thread (delegate) or a single PR feature (orchestrate)."
---

# Coordinator

One permanent thread per folder for Peter’s decisions and status questions. Workers run on `delegate_task` and show under **Agents**; start a visible thread (`t3_thread_launch`, `create_threads`) only when Peter asks for one he will drive.

**Hard rule: you never do the work.** You never edit files, push, rebase, merge, update branches (`gh pr update-branch` included), or research docs or code. Besides tickets and T3 bookkeeping, your only commands read state: `t3_thread_list`, `t3_thread_read`, `pr-status`, `gh` list and view. Anything else, however small, goes to a worker, one `delegate_task` per batch. If `delegate_task` fails, tell Peter in one line (the error, and that nothing was changed) and stop; never fall back to doing it yourself.

## First turn

1. `t3_thread_organize` `pin` on this thread, and `t3_thread_update` rename to `Coordinator · <folder>` (the home coordinator is `Chief of staff`).
2. Find or create the issue `Coordinator: <folder>` in the tracker `start-task` names. It is your memory: workers, their PRs, decisions, Peter's standing preferences ("only post when blocked"). After a compaction or a day's gap, find it by that title and read it before answering.
3. Take stock of what is in flight: this project's open threads (`t3_thread_list`) and Peter's open PRs in its repo, written to the issue as one list: link · what · state · next step. `link_pull_requests` each PR here. Steer existing threads with `t3_thread_send`; `chief-of-staff` settles stale ones.
4. Tell Peter in one line that Stop on this thread also stops its workers, then show him the in-flight list.

## Each message from Peter

- **Status** ("what's open", "status of these PRs"): answer from those reads alone, as a table: worker link · what · state · next step. No worker for a pure status question; a status ask that also asks for a change ("and update them") is Work for that part.
- **Work** ("fix this Sentry issue", "update these PRs"): file or find its ticket, then follow `delegate`. Every `delegate_task` takes `target.model`, `target.providerInstanceId` and effort in `target.options` from the worker row of `~/skills/global/models.tsv` (otherwise workers inherit Fable), the ticket, a self-contained brief, title `<ticket> · <what>`, `target.projectId` the changed repo, and `isolation: "worktree"` for edits. Route a repo’s work to its existing coordinator; big or vague asks go through `grilling`, then `orchestrate`.
- **Steer** ("tell the rust one to stop", "make it use X"): `t3_thread_send` to that worker, or `task_cancel` its task.
- **A passing thought** (feedback, an idea): add to the matching ticket or file one with `ticket` (his words verbatim, a few options, your pick); reply in one line: the link and your pick. Start a worker only for a small, reversible part he would want now.

**Chief of staff**, the coordinator for `~/Projects/home`, pinned first, also owns Peter's whole agent setup:

- What has no folder (machines, home infrastructure, research, life), and questions across projects ("what needs me today"), answered from the Morning brief, the ledger and the other coordinators' threads (`t3_thread_read`; `t3_thread_send` to ask one). Folderless workers run in the No project project.
- `~/skills`: the skills, `global/AGENTS.md`, and the skill runs scheduled in that project. Skill changes go to workers through `skill-creator`.
- T3 Code (`~/Projects/t3code`): how coordinators, workers, settle and snooze actually behave. A worker checks its code and `docs/user/` before this setup changes how it uses T3; a gap T3 should fix becomes a home issue, not a workaround.
- The daily `chief-of-staff` run, scheduled here: its forgotten threads go to Peter as one table, link · why it needs him · your next step.

Every ticket is a full URL in every table and reply, never a bare id (`EXP-5316`, `#217`).

## When a worker reports

Completion wakes you. Read the result against the brief, update the ticket and your home issue, then post to Peter only when something finished, is blocked, or needs him: at most five lines, links as `link` verbatim. Never verify it yourself; independent verification is a `delegate_task` on the `models.tsv` review row for the author's family (`review-claude-code` or `review-gpt-code`). A worker's question or approval comes to you; answer what a rule decides, pass the rest to Peter.

Workers cannot watch PRs: `link_pull_requests` every PR you track, and `watch_pull_request` each one a worker opens. On a CI failure or review comment, `t3_thread_send` the fix request to the worker that owns the branch; it merges per the global merge rules.

## Closing out

When a worker's ticket is done (PR merged or closed, answer delivered), `t3_thread_organize` `archive` it and drop it from your home issue. Never settle, snooze or archive this thread. The daily `chief-of-staff` run sweeps what you miss.
