---
name: t3-loadbalancer
description: "Use when acting as the Load Balancer thread, or when asked to move running T3 Code threads between Claude accounts (Tom, Jerry) and codex because one is low on 5-hour usage or has recovered."
---

# T3 load balancer

One run = read usage, apply the stop rule, list threads, move what needs moving, report. Your write actions are `t3_thread_configure` (model selection) and, only under the stop rule below, `t3_thread_interrupt`. Never edit code, answer agents, cancel, restart or settle threads. Never use the `opencode` provider or any `opencode/...` model.

## 1. Read usage

`T3 does not return usage through MCP.` Read it from the provider logs:

```
python3 -I ~/skills/t3-loadbalancer/scripts/read-usage.py
```

It prints, per provider instance (`claude1_`, `claudeAgent`), the latest `five_hour` and `seven_day` windows. `remaining_pct` is what you act on. Notes:

- Source is Claude `rate_limit_event` lines in `~/.t3/userdata/logs/provider/events.*.log`; utilization is a 0-1 fraction used. A window whose `resets_at_local` has passed is reported as 100% remaining.
- An instance with no recent events (no thread running on it) has no entry: report `unknown (no recent events)` and do not treat it as low. Check `reading_age_min`; over ~30 minutes is stale, say so.
- `is_using_overage: true` or `status: rejected` means the account is out: treat remaining as 0%.
- Codex reports nothing here. Report it `unknown`.
- The numbers are an estimate from logs, not the UI panel. If Peter gives a different number, trust Peter.

An account is **out** when five-hour OR weekly remaining is under 2%. It is **recovered** when five-hour remaining is over 50% (and weekly is over 2%).

## 1b. Stop rule (overrides the move rules below)

If any Claude account's five-hour OR weekly `remaining_pct` is under 2%, or `status: rejected`, or `is_using_overage: true`, immediately stop all work. Do not move threads instead.

1. Run `t3_thread_list` for every project (statuses running, starting, queued, preparing, waiting; `includeSubagents: true`).
2. Call `t3_thread_interrupt` on every thread in the list except this Load Balancer thread. Reason: `load-balancer stop rule: <account> <window> at <n>% remaining`. Use `clientRequestId` `lb-stop-<threadId>-<UTC time to the minute>`. Include threads on healthy accounts.
3. List the threads again. Interrupt any that are still running.
4. Do not resume, restart or reconfigure anything. Append `{ts, action:"stop", account, window, remaining, threads:[...]}` to `~/.t3/loadbalancer/moves.json`.
5. Report the stop first: which account tripped, its numbers, which threads were interrupted, and that Peter has to resume them. While the account stays under 2%, later runs only report; they do not interrupt again.

## 2. List threads

`t3_project_list`, then `t3_thread_list` per project with `statuses: ["running","starting","queued","preparing","waiting"]`, `includeSubagents: true`, `limit: 100`. Record `threadId`, `providerInstanceId`, `model`. Read the current options with `t3_thread_configuration`.

Priority threads (move first): the thread IDs listed in `~/.t3/loadbalancer-priority.md` (kept outside this public repo), and all their subagents (`parentThreadId` chain). If the file is missing, treat no thread as priority. Leave this Load Balancer thread alone unless its own account is out.

## 3. Decide

Equivalence table. Same model first. Only the targets in this table.

| Tier | Same model (preferred) | Other equivalents |
|---|---|---|
| Claude Opus 5.5 | claude1_ / claude-opus-5-5 | claudeAgent / claude-opus-5-5; codex / gpt-6.1-sol |
| Claude Sonnet 5.5 | claude1_ / claude-sonnet-5-5 | claudeAgent / claude-sonnet-5-5; codex / gpt-6.1-sol |
| Claude Fable 5.2 | claude1_ / claude-fable-5-2 | claudeAgent / claude-fable-5-2 |
| Claude Fable 5.1 | claude1_ / claude-fable-5-1 | claudeAgent / claude-fable-5-1 |
| Claude Haiku 5.5 | claude1_ / claude-haiku-5-5 | claudeAgent / claude-haiku-5-5 |

Rules, in order:

1. **Move off an out account.** For each thread on an out Claude account, pick the first target that is not out: the other Claude account, then `codex` / `gpt-6.1-sol` at high (Opus and Sonnet only; a provider switch takes effect on the next turn and starts a fresh context, so say so). If both Claude accounts are out and the model is Fable or Haiku, leave it and report it.
2. **Move back when recovered.** For each thread currently on codex (or any fallback) that the ledger shows you moved, go back to its original Claude account once that account is recovered (over 50%). Peter's standing permission: always switch back to claude1_ / claudeAgent from the fallback when they are back over 50%.
3. **Never ping-pong.** Do not move a thread that is already on a non-out account just to balance. Do not move a thread onto an account that is under 50% unless it is the only non-out choice. Peter placed `top-13997` on claude1_; do not move it back to claudeAgent.
4. **Priority threads and their subagents first**, then the rest.
5. Moving a running thread: config may apply from its next turn. Say so in the report; do not interrupt it.

## 4. Move

`t3_thread_configure` with `threadId` and `modelSelection: {instanceId, model, options}`. Keep the thread's current effort. Option ids differ per provider, so check `orchestrator_capabilities` first:

- claude1_ / claudeAgent: `[{"id":"effort","value":"<effort>"}]` (Opus also has `fastMode`; carry it over if set).
- codex `gpt-6.1-sol`: `[{"id":"reasoningEffort","value":"high"}]` (never above high).

Afterwards re-read with `t3_thread_configuration` and confirm `instanceId`/`model`/effort.

Keep a ledger at `~/.t3/loadbalancer/moves.json` (create the dir): a JSON array of `{ts, threadId, title, from:{instanceId,model,options}, to:{...}, reason}`. Read it before step 3 rule 2; append after every move; remove a thread's open entry when you move it back.

## 5. Report (to this thread, every run)

Keep it short. Lead with whether anything moved or stopped. When nothing changed, one line (account percentages and 'no action') is enough.

- Usage table: Tom, Jerry: five-hour remaining %, weekly remaining %, reset time, reading age.
- Moves this run (table: thread, from, to, effort, applied-now or next-turn) or "none".
- Threads still on a low account, and threads parked on codex waiting for recovery.
- Anything unmeasurable or stale.
