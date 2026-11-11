---
name: delegate
description: Route and brief subagents with Peter's model and effort table, self-contained tickets, a fixed review reply format, stall checks and retry rules. Use whenever you hand an investigation, implementation ticket or review to another agent. For a whole feature or multi-PR program, start with orchestrate, which uses this skill.
---

# Delegate

On a program of several tickets, plan and write tickets; let subagents investigate, implement and verify. Keep your own context for decisions and review. Delegation does not expand the user's authorization to change files, push, merge, deploy, or answer approvals.

## Pick the model and effort

Grok is never used, for anything, through any provider. A Grok review does not satisfy a tier 2 gate: the PR is re-reviewed by the GPT reviewer below. Never use the `opencode` provider or any `opencode/...` model, even through another provider instance. The `model-guard` hook denies a T3 call that names either, and `scheduled-models` flags a scheduled task on one. The catalog does not report usage or quota; model availability alone does not mean an account has capacity.

| Work | Provider / model | Effort |
| --- | --- | --- |
| Implementation ticket | `claude-sonnet-5-5`, alternating `claudeAgent` and `claude1_` | medium |
| Read-only investigation: inventories, "find every place that…", log digging, spec or backend research | `claude-sonnet-5-5` (`claudeAgent` / `claude1_`) | medium |
| The GPT reviewer: review of a PR, design or contract | Sol (`gpt-6.1-sol`) on `codex` | xhigh |
| The Claude reviewer: when a task names a second model family, or the code under review was written by GPT | `claude-fable-5-2` on `claudeAgent` / `claude1_` | high |
| Hardest reviews only | `claude-opus-5-5` on `claudeAgent` / `claude1_` | high |
| Scheduled workers (the Worker task and any task that does ticket work); create the task from a thread set to this, since `schedule_task` copies the caller's model. No scheduled task runs Fable; Fable is for the chief of staff chat | `claude-opus-5-5` on `claudeAgent` | high |

Before launch, call `orchestrator_capabilities` and confirm the provider instance can run child tasks and supports the chosen model and option values. Track the last implementation provider in the parent thread to alternate accounts. If a requested target is unavailable, report the mismatch; do not silently substitute a provider, model, or effort.

For these routes, use T3 `delegate_task` with `target.providerInstanceId`, `target.model`, and explicit `target.options`. An effort word in the brief does not configure the model. For example:

```json
[
  {"providerInstanceId":"claudeAgent","model":"claude-sonnet-5-5","options":{"effort":"medium"}},
  {"providerInstanceId":"claude1_","model":"claude-sonnet-5-5","options":{"effort":"medium"}},
  {"providerInstanceId":"codex","model":"gpt-6.1-sol","options":{"reasoningEffort":"xhigh"}}
]
```

Raise a Sonnet ticket to `high` only when its first attempt came back wrong. Options inherit only for the same provider instance and model; explicit entries override individual inherited values. Do not copy options to models that do not support them. Check the returned provider, model, and options against the requested target before trusting the task's work.

Retain the returned `taskId` and `childThreadId`; manage the task by `taskId`. Use a distinct `clientRequestId` for each ticket or independent review round and reuse it only for retries of that launch. For another review round call `delegate_task` again with the original brief, prior findings, responses, and unresolved objections; do not start the round by messaging the old child thread. Never use `t3_thread_launch` or `create_threads` as substitutes for subagents.

## Write the ticket

A subagent starts with no parent conversation and no global instructions, so the brief itself carries the skill it must follow and the proof rule. Every ticket states:

1. **Goal**: one or two sentences, and the hard rules (e.g. "UI must not change", "never edit node_modules").
2. **Read first**: the "Finish every change" section of `~/skills/global/AGENTS.md`, named by path, for any ticket that changes files; then exact paths, repository/worktree location, starting branch and revision, and relevant prior decisions or findings.
3. **Do exactly these**: numbered changes with file paths; what is out of scope. For research or review, name the questions and permitted read-only actions instead of prescribing edits.
4. **Proof**: copy this sentence into the brief word for word: "Proof means running the real UI, API or CLI with representative data and showing expected next to actual. A pass count or a finished job is not proof." Require each test to name the user-visible rule or bug it protects in its title, and forbid citing test or path counts in the report. Then two blocks, with expected results taken from outside the change: Verification, numbered checks of input → expected value, and Validation, one real-flow scenario with real data. Exercise the actual affected flow and include cases that expose plausible wrong implementations. If planted-bug checks are appropriate and authorized, use an isolated local copy, restore every temporary change, and never touch live data. Do not require code mutation for read-only work. Save inspectable evidence in a git-ignored path or outside the repo; report what could not be verified.
5. **Checks**: the repo's type-check, lint, format, tests, with exact commands and known traps (e.g. formatter with no file args rewrites unrelated files). Scale checks to the task; do not run paid or unrelated flows just to validate prose.
6. **Git**: signed commits only when committing; never `--no-verify`, never edit git config. State whether to commit or leave changes uncommitted, and whether pushing is authorized. If signing is unavailable, preserve the work and report the blocker rather than creating an unsigned commit. Follow explicit user and repository instructions.
7. **Report**: short enough to read in a minute, written for a reader who saw none of the work, and exactly what to include (SHAs, changed paths, expected versus actual proof, check results, anything skipped or blocked).
8. **Obstacles and scratch files**: errors, timeouts and failing tools are ordinary: diagnose and work through them. Retrying a read-only command needs no approval. Report as blocked only when access was withheld on purpose, the ticket's hard rules forbid the next step, or the same step failed twice for the same cause. Scratch files go in `.verification/<task>/`, never in a folder the task shares; delete only files you created, by name.
9. **Stop condition**: the observable acceptance result and exact command when applicable (e.g. `yarn exchange-core:verify` → the independently established expected result). A blocker also requires a final report, not endless retries. Say: "end the turn immediately after the final report; do not call Get task output, continue polling, or start follow-up work".

Use `delegate_task` with `isolation: "worktree"` when tasks edit files in parallel or the main checkout is in use. It starts from the parent local commit and runs project setup; uncommitted edits are not copied. Commit required inputs before launch, or pass necessary context explicitly. Do not ask the child to create its own worktree. Read-only tasks may share the checkout; avoid concurrent commands that change it.

## Watch it

- Async completion wakes the parent: end the turn when waiting solely for that result, and never keep a polling loop open. When you do look at a live task, use `task_status` for `workState`, pending requests, and nested child runs. If a periodic wake is needed, use an existing watchdog or a user-authorized schedule; do not create recurring work implicitly.
- Read `t3_thread_read` activity tails, item timestamps, and `itemCount` growth; `updatedAt` alone can reflect housekeeping. Inspect the awaited process, logs, or CI result when needed. A progressing build, live nested child, or idle dev server waiting for requests is not a stall.
- At 10 minutes without real progress, diagnose before acting. Check pending questions/approvals; surface anything that needs Peter and leave those tasks waiting. If genuinely stalled rather than waiting on live work or Peter, cancel the owned task with `task_cancel`, confirm it has stopped, inspect and preserve its worktree changes, then take over or re-delegate a smaller ticket. Do not run a replacement writer against files the original task can still edit.
- Steer a running task with `t3_thread_send` (`threadId: childThreadId`, `mode: "steer"`) when requirements change mid-task; this is an in-flight update, not a new independent review round. Include a stable `clientRequestId` for retries.
- A "completed" turn can still have live nested work. Check `workState`, `hasPendingChildRuns`, and the final result before treating the task as finished. If the final message is missing, inspect its worktree (`git log`, `git status`, the proof file) before trusting or re-running it.
- A final report with its run still open is a distinct stall: ask the child to end the turn and explain anything keeping it open. Do not call `Get task output` after your own final report.
- Retry by cause, at most twice per ticket, then report it as blocked: out of context or memory → a smaller ticket; dropped connection or provider error → the same ticket again; the same tool or command failing twice → a different model or a ticket that avoids that step.

## Review replies

Ask every reviewer for exactly this format, and treat a timeout, an error or no reply as not approved:

```
VERDICT: APPROVE | CHANGES
R1 blocker|should|nit path:line — what goes wrong, with the input or state — the command and output that show it — suggested fix
```

- **blocker**: the case the task is for is wrong. **should**: a real bug callers will hit. **nit**: everything else, including rare paths, whatever label the reviewer chose.
- Keep the ids (`R1`, `R2`, …) across rounds so each re-check answers the same list.
- A finding without a command, output or exact input that shows the failure is a question, not a finding. Rerun the command yourself before passing a finding to the worker; drop what you can't reproduce.

## Verify the result

Do not review the code yourself when orchestrating; the reviewer does that (see `orchestrate` step 5). Read the proof and gate evidence yourself. Compare the claimed result with the independent expected result and re-run the affected flow and required checks on the final combined artifact. Passing checks or a subagent's report alone do not prove the behavior. Mark blocked claims `implemented, unverified` with the missing prerequisite.

Integrate the child's commits locally only within the authorized task. If local integration changes the target branch or its dependencies, repeat the affected verification there before handoff.