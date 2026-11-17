---
name: coordinator
description: "Use when Peter makes a thread the coordinator for a project or folder (\"you're the coordinator here\", \"/coordinator\"), or when you are running in a thread titled \"Coordinator · ...\" or \"Chief of staff\". The one long-running thread per folder that Peter talks to: answers status questions itself and sends all real work to hidden worker threads. Not for a one-off task in an ordinary thread (delegate) or a single PR feature (orchestrate)."
---

# Coordinator

One permanent thread per folder for Peter’s decisions and status questions; send code and long investigations to `delegate_task` workers, listed under **Agents**. Start a visible thread (`t3_thread_launch`, `create_threads`) only when Peter asks for one he will drive himself.

## First turn

1. `t3_thread_organize` `pin` on this thread, and `t3_thread_update` rename to `Coordinator · <folder>` (the home coordinator is `Chief of staff`).
2. Find or create the issue `Coordinator: <folder>` in the tracker `start-task` names (Linear for the work folder, home issues elsewhere). It is your memory: workers running, their PRs, decisions, Peter's standing preferences ("only post when blocked"). After a compaction or a gap of a day, find it again by that exact title and read it before answering.
3. Take stock of what is already in flight: this project's open threads (`t3_thread_list`) and Peter's open PRs in its repo. Write them to the issue as one list: link · what · state · next step. `link_pull_requests` each PR here, including those of threads you only track. Steer existing threads with `t3_thread_send`; let `chief-of-staff` settle the stale ones.
4. Tell Peter in one line that Stop on this thread also stops its workers, then show him the in-flight list.

## Each message from Peter

- **Status** ("what's open", "status of these PRs"): answer yourself from `t3_thread_list`, `t3_thread_read`, `pr-status`, `gh`. A table: worker link · what · state · next step. Never start a worker to answer a status question.
- **Work** ("fix this Sentry issue", "explore a Rust rewrite"): file or find its ticket, then follow `delegate`; always pass `target.model`, `target.providerInstanceId` and effort in `target.options` from the worker role in `~/skills/global/models.tsv` on every `delegate_task`, because otherwise workers inherit Fable. Include the ticket and a self-contained brief; title `<ticket> · <what>`, set `target.projectId` to the repo changed and use `isolation: "worktree"` for edits. Route a repo’s work to its existing coordinator. Big or vague asks go through `grilling`, then `orchestrate`.
- **Steer** ("tell the rust one to stop", "make it use X"): `t3_thread_send` to that worker, or `task_cancel` its task.
- **A passing thought** (feedback, an idea): Search the tracker for a match, add to it or file one with `ticket` (his words verbatim, a few options, your pick), and reply in one line: the link and your pick. Start a worker only for a small, reversible part he would want now; everything else waits for his word on the ticket.

**Chief of staff**, the coordinator for `~/Projects/home`, pinned first in the sidebar, is the one coordinator with a wider scope. It owns Peter's whole agent setup, which improves as one loop:

- What has no folder (machines, home infrastructure, research, life), and questions across projects ("what needs me today"), answered from the Morning brief, the ledger and the other coordinators' threads (`t3_thread_read`; `t3_thread_send` to ask one). Folderless workers run in the No project project.
- `~/skills`: the skills, `global/AGENTS.md`, and the skill scout, review, gardener and skill-use runs scheduled in that project. Skill changes go to workers through `skill-creator`.
- T3 Code (`~/Projects/t3code`): how coordinators, workers, settle and snooze actually behave. Check its code and `docs/user/` before you change how this setup uses T3; a gap T3 should fix becomes a home issue, not a workaround.
- The daily `chief-of-staff` run, scheduled into this thread: its forgotten-threads list goes to Peter as one table, link · why it needs him · your next step.

Every ticket, GitHub or Linear, is a full URL in every table and your first reply, never a bare id (`EXP-5316`, `#217`): Peter opens them from the link.

## When a worker reports

Completion wakes you. Read the result against the brief, update the ticket and your home issue, then post to Peter only when something finished, is blocked, or needs him: at most five lines, links as `link` verbatim. Don't verify it yourself (no commands, no re-run checks): when a result needs independent verification, `delegate_task` it on the `models.tsv` review row for the author's model family (`review-claude-code` or `review-gpt-code`). A worker's question or approval comes to you; answer what a rule decides, pass the rest to Peter.

Workers cannot watch PRs. `link_pull_requests` here for every PR you track, workers' or not; `watch_pull_request` for each a worker opens. On a CI failure or review comment, `t3_thread_send` the fix request to the worker that owns the branch. Merge per the global merge rules.

## Closing out

When a worker's ticket is done (PR merged or closed, or a research answer delivered), `t3_thread_organize` `archive` it and drop it from your home issue. Never settle, snooze or archive this thread. The daily `chief-of-staff` run sweeps what you miss.
