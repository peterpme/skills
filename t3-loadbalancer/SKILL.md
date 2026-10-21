---
name: t3-loadbalancer
description: Keep Peter's running T3 Code threads moving by reading each Claude account's 5-hour usage and moving threads between claude1_ (Tom), claudeAgent (Jerry) and cursor when an account runs low or recovers. Use when acting as the Load Balancer thread or when asked to rebalance T3 threads by usage.
---

# T3 load balancer

One run = read usage, list threads, move what needs moving, report. Your only write action is `t3_thread_configure` (model selection). Never edit code, answer agents, interrupt, cancel, restart or settle threads. Never use the `opencode` provider or any `opencode/...` model.

## 1. Read usage

`T3 does not return usage through MCP.` Read it from the provider logs:

```
python3 -I ~/skills/t3-loadbalancer/scripts/read-usage.py
```

It prints, per provider instance (`claude1_`, `claudeAgent`), the latest `five_hour` and `seven_day` windows. `remaining_pct` is what you act on. Notes:

- Source is Claude `rate_limit_event` lines in `~/.t3/userdata/logs/provider/events.*.log`; utilization is a 0-1 fraction used. A window whose `resets_at_local` has passed is reported as 100% remaining.
- An instance with no recent events (no thread running on it) has no entry: report `unknown (no recent events)` and do not treat it as low. Check `reading_age_min`; over ~30 minutes is stale, say so.
- `is_using_overage: true` or `status: rejected` means the account is out: treat remaining as 0%.
- Cursor, grok, codex and antigravity report nothing here. Report them `unknown`.
- The numbers are an estimate from logs, not the UI panel. If Peter gives a different number, trust Peter.

An account is **out** when five-hour OR weekly remaining is under 2%. It is **recovered** when five-hour remaining is over 50% (and weekly is over 2%).

## 2. List threads

`t3_project_list`, then `t3_thread_list` per project with `statuses: ["running","starting","queued","preparing","waiting"]`, `includeSubagents: true`, `limit: 100`. Record `threadId`, `providerInstanceId`, `model`. Read the current options with `t3_thread_configuration`.

Priority threads (move first): `bda0885f-92a9-4fea-8d5e-dbed0c16dc72` (Build Trustworthy Agent Workflows), `760e86c6-1b74-4e93-97fb-b8207b8d74d2` (Map and Secure Backpack API Operations), `32f8a70c-738a-4ea5-a637-54be3960b9cd` (Evaluate SEC Parser Against Gold Data), and all their subagents (`parentThreadId` chain). Leave this Load Balancer thread alone unless its own account is out.

## 3. Decide

Equivalence table. Same model first.

| Tier | Same model (preferred) | Other equivalents |
|---|---|---|
| Claude Opus 5.5 | claude1_ / claude-opus-5-5 | claudeAgent / claude-opus-5-5; cursor / claude-opus-5-5 |
| Claude Sonnet 5.5 | claude1_ / claude-sonnet-5-5 | claudeAgent / claude-sonnet-5-5; cursor / claude-sonnet-5-5 |
| Claude Fable 5.1 | claude1_ / claude-fable-5-1 | claudeAgent / claude-fable-5-1 |
| Claude Haiku 5.5 | claude1_ / claude-haiku-5-5 | claudeAgent / claude-haiku-5-5 |
| Grok 4.7 | grok / grok-4.7 | cursor / grok-4.7 |
| GPT-6.1 Sol | codex / gpt-6.1-sol | cursor / gpt-5.6-sol |
| Gemini 3.8 Flash | antigravity / gemini-3.8-flash-high | cursor / gemini-3.8-flash |

Rules, in order:

1. **Move off an out account.** For each thread on an out Claude account, pick the first target that is not out: the other Claude account, then cursor (Opus/Sonnet only). If both Claude accounts are out and the model has no cursor row (Fable, Haiku), leave it and report it.
2. **Move back when recovered.** For each thread currently on cursor (or any fallback) that the ledger shows you moved, go back to its original Claude account once that account is recovered (over 50%). Peter's standing permission: always switch back to claude1_ / claudeAgent from cursor when they are back over 50%.
3. **Never ping-pong.** Do not move a thread that is already on a non-out account just to balance. Do not move a thread onto an account that is under 50% unless it is the only non-out choice. Peter explicitly placed `top-13997` on claude1_ on 2026-10-20; do not move it back to claudeAgent.
4. **Priority threads and their subagents first**, then the rest.
5. Moving a running thread: config may apply from its next turn. Say so in the report; do not interrupt it.

## 4. Move

`t3_thread_configure` with `threadId` and `modelSelection: {instanceId, model, options}`. Keep the thread's current effort. Option ids differ per provider, so check `orchestrator_capabilities` first:

- claude1_ / claudeAgent: `[{"id":"effort","value":"<effort>"}]` (Opus also has `fastMode`; carry it over if set).
- cursor `claude-opus-5-5`: `effort` (low/medium/high/xhigh/max). cursor `claude-sonnet-5-5`: `reasoning_effort`. Keep `contextWindow` at its default.

Afterwards re-read with `t3_thread_configuration` and confirm `instanceId`/`model`/effort.

Keep a ledger at `~/.t3/loadbalancer/moves.json` (create the dir): a JSON array of `{ts, threadId, title, from:{instanceId,model,options}, to:{...}, reason}`. Read it before step 3 rule 2; append after every move; remove a thread's open entry when you move it back.

## 5. Report (to this thread, every run)

Keep it short. Lead with whether anything moved.

- Usage table: Tom, Jerry: five-hour remaining %, weekly remaining %, reset time, reading age.
- Moves this run (table: thread, from, to, effort, applied-now or next-turn) or "none".
- Threads still on a low account, and threads parked on cursor waiting for recovery.
- Anything unmeasurable or stale.
