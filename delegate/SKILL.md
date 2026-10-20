---
name: delegate
description: Hand work to subagents (Grok 4.7, Sonnet, Codex, Fable/Opus) with the right model and effort, a ticket they can pick up cold, a time box, stall checks, and proof you verify yourself. Use before delegating any investigation, implementation, or review on a multi-step program.
---

# Delegate

On a program of several tickets, plan and write tickets; let subagents investigate, implement and verify. Keep your own context for decisions and review.

## Pick the model and effort

Current routing (2026-10-20: Grok 4.7 capacity is running out — do not start new tasks on the `grok` provider; let running ones finish. Never use the `opencode` provider):

| Work | Provider / model | Effort |
| --- | --- | --- |
| Implementation ticket | `claude-sonnet-5-5`, alternating `claudeAgent` and `claude1_` | high |
| Read-only investigation: inventories, "find every place that…", log digging, spec or backend research | `claude-sonnet-5-5` (`claudeAgent` / `claude1_`) | medium |
| Review of a PR or design | Sol (`gpt-6.1-sol`) on `codex` | xhigh |
| Hardest reviews only | Opus (`claude-opus-5-5`) | high |

When Grok 4.7 is available again: investigations on Grok low/medium, implementation on Grok high/xhigh.

## Write the ticket

A subagent starts with no context. Every ticket states:

1. **Goal**: one or two sentences, and the hard rules (e.g. "UI must not change", "never edit node_modules").
2. **Read first**: exact file paths.
3. **Do exactly these**: numbered changes with file paths; what is out of scope.
4. **Proof**: input → expected result, taken from outside the change. For code: run the real flow, and plant one or two bugs to show the check catches them, then restore. Say where to save the proof (a git-ignored path).
5. **Checks**: the repo's type-check, lint, format, tests, with exact commands and known traps (e.g. formatter with no file args rewrites unrelated files).
6. **Git**: signed commits only, never `--no-verify`, never edit git config; commit or leave uncommitted; do not push unless asked.
7. **Report**: a line limit (15–35 lines) and exactly what to include (SHAs, counts, proof results, anything skipped).
8. **Time box**: 25–45 minutes; "if stuck 10 minutes on one thing, write down where you are and report".
9. **Stop condition**: the exact acceptance command that must pass (e.g. `yarn exchange-core:verify` → N passed), and "after the final report, end your turn — do not continue or start follow-up work".

Keep implementation briefs tight: exact files to touch, nothing open-ended.

Use worktree isolation when tasks edit files in parallel or the main checkout is in use; merge their commits yourself.

## Watch it

- Check every ~5 minutes (`task_status`, or `t3_thread_read` for `updatedAt`). Don't wait only for the completion notice.
- No activity for 10 minutes: cancel and take over, or re-delegate a smaller ticket.
- Steer a running task with `t3_thread_send` (mode `steer`) when requirements change mid-task.
- A "completed" task may have no final message: check its worktree (`git log`, `git status`, the proof file) before trusting or re-running it.

## Verify before you merge

Read the diff and the proof file yourself. Re-run the checks on the target branch after merging (dependencies or master may have moved). Never report a subagent's claim as verified until you have seen the evidence.
