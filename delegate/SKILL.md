---
name: delegate
description: Delegate multi-step investigations, implementation tickets, and reviews with Peter's model and effort routing, self-contained briefs, stall checks, and independently verified results.
---

# Delegate

On a program of several tickets, plan and write tickets; let subagents investigate, implement and verify. Keep your own context for decisions and review. Delegation does not expand the user's authorization to change files, push, merge, deploy, or answer approvals.

## Pick the model and effort

Current routing (2026-10-20): do not start new Grok tasks through any provider; let running ones finish. Resume Grok routing only when Peter explicitly lifts the pause. Never use the `opencode` provider or any `opencode/...` model, even through another provider instance. The catalog does not report usage or quota; model availability alone does not mean an account has capacity.

| Work | Provider / model | Effort |
| --- | --- | --- |
| Implementation ticket | `claude-sonnet-5-5`, alternating `claudeAgent` and `claude1_` | high |
| Read-only investigation: inventories, "find every place that…", log digging, spec or backend research | `claude-sonnet-5-5` (`claudeAgent` / `claude1_`) | medium |
| Review of a PR or design | Sol (`gpt-6.1-sol`) on `codex` | xhigh |
| Hardest reviews only | `claude-opus-5-5` on `claudeAgent` / `claude1_` | high |

After Peter lifts the Grok pause: investigations on Grok low/medium, implementation on Grok high/xhigh, subject to the live catalog's supported options.

Before launch, call `orchestrator_capabilities` and confirm the provider instance can run child tasks and supports the chosen model and option values. Track the last implementation provider in the parent thread to alternate accounts. If a requested target is unavailable, report the mismatch; do not silently substitute a provider, model, or effort.

For these routes, use T3 `delegate_task` with `target.providerInstanceId`, `target.model`, and explicit `target.options`. An effort word in the brief does not configure the model. For example:

```json
[
  {"providerInstanceId":"claudeAgent","model":"claude-sonnet-5-5","options":{"effort":"high"}},
  {"providerInstanceId":"claude1_","model":"claude-sonnet-5-5","options":{"effort":"high"}},
  {"providerInstanceId":"codex","model":"gpt-6.1-sol","options":{"reasoningEffort":"xhigh"}}
]
```

Use `effort: "medium"` for Sonnet investigations and `effort: "high"` for Opus reviews. Options inherit only for the same provider instance and model; explicit entries override individual inherited values. Do not copy options to models that do not support them. Check the returned provider, model, and options against the requested target before trusting the task's work.

Retain the returned `taskId` and `childThreadId`; manage the task by `taskId`. Use a distinct `clientRequestId` for each ticket or independent review round and reuse it only for retries of that launch. For another review round call `delegate_task` again with the original brief, prior findings, responses, and unresolved objections; do not start the round by messaging the old child thread. Never use `t3_thread_launch` or `create_threads` as substitutes for subagents.

## Write the ticket

A subagent starts with no parent conversation. Every ticket states:

1. **Goal**: one or two sentences, and the hard rules (e.g. "UI must not change", "never edit node_modules").
2. **Read first**: exact paths, repository/worktree location, starting branch and revision, and relevant prior decisions or findings.
3. **Do exactly these**: numbered changes with file paths; what is out of scope. For research or review, name the questions and permitted read-only actions instead of prescribing edits.
4. **Proof**: input → expected result, taken from outside the change. Exercise the actual affected flow and include cases that expose plausible wrong implementations. If planted-bug checks are appropriate and authorized, use an isolated local copy, restore every temporary change, and never touch live data. Do not require code mutation for read-only work. Save inspectable evidence in a git-ignored path or outside the repo; report what could not be verified.
5. **Checks**: the repo's type-check, lint, format, tests, with exact commands and known traps (e.g. formatter with no file args rewrites unrelated files). Scale checks to the task; do not run paid or unrelated flows just to validate prose.
6. **Git**: signed commits only when committing; never `--no-verify`, never edit git config. State whether to commit or leave changes uncommitted, and whether pushing is authorized. If signing is unavailable, preserve the work and report the blocker rather than creating an unsigned commit. Follow explicit user and repository instructions.
7. **Report**: a line limit (15–35 lines) and exactly what to include (SHAs, changed paths, expected versus actual proof, check results, anything skipped or blocked).
8. **Time box**: 25–45 minutes; "if stuck 10 minutes on one thing, write down where you are and report".
9. **Stop condition**: the observable acceptance result and exact command when applicable (e.g. `yarn exchange-core:verify` → the independently established expected result). A blocker also requires a final report, not endless retries. Say: "end the turn immediately after the final report; do not call Get task output, continue polling, or start follow-up work".

Keep implementation briefs tight: exact files to touch, nothing open-ended.

Use `delegate_task` with `isolation: "worktree"` when tasks edit files in parallel or the main checkout is in use. It starts from the parent local commit and runs project setup; uncommitted edits are not copied. Commit required inputs before launch, or pass necessary context explicitly. Do not ask the child to create its own worktree. Read-only tasks may share the checkout; avoid concurrent commands that change it.

## Watch it

- Review live tasks about every 5 minutes when orchestrating. Use `task_status` for `workState`, pending requests, and nested child runs. Async completion wakes the parent; end the turn when waiting solely for that result instead of keeping a polling loop open. If a periodic wake is needed, use an existing watchdog or a user-authorized schedule; do not create recurring work implicitly.
- Read `t3_thread_read` activity tails, item timestamps, and `itemCount` growth; `updatedAt` alone can reflect housekeeping. Inspect the awaited process, logs, or CI result when needed. A progressing build, live nested child, or idle dev server waiting for requests is not a stall.
- At 10 minutes without real progress, diagnose before acting. Check pending questions/approvals; surface anything that needs Peter and leave those tasks waiting. If genuinely stalled rather than waiting on live work or Peter, cancel the owned task with `task_cancel`, confirm it has stopped, inspect and preserve its worktree changes, then take over or re-delegate a smaller ticket. Do not run a replacement writer against files the original task can still edit.
- Steer a running task with `t3_thread_send` (`threadId: childThreadId`, `mode: "steer"`) when requirements change mid-task; this is an in-flight update, not a new independent review round. Include a stable `clientRequestId` for retries.
- A "completed" turn can still have live nested work. Check `workState`, `hasPendingChildRuns`, and the final result before treating the task as finished. If the final message is missing, inspect its worktree (`git log`, `git status`, the proof file) before trusting or re-running it.
- A final report with its run still open is a distinct stall: ask the child to end the turn and explain anything keeping it open. Do not call `Get task output` after your own final report.

## Verify before you merge

Read the diff and proof yourself. Compare the claimed result with the independent expected result and re-run the affected flow and required checks on the final combined artifact. Passing checks or a subagent's report alone do not prove the behavior. Mark blocked claims `implemented, unverified` with the missing prerequisite.

Integrate the child's commits locally only within the authorized task. A skill does not authorize merging a pull request: follow the user's merge instructions and the repository's completion workflow. If local integration changes the target branch or its dependencies, repeat the affected verification there before handoff. Never report a subagent's claim as verified until you have inspected the evidence.
