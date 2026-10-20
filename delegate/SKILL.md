---
name: delegate
description: Hand work to subagents (Grok 4.7, Sonnet, Codex, Fable/Opus) with the right model and effort, a ticket they can pick up cold, a time box, stall checks, and proof you verify yourself. Use before delegating any investigation, implementation, or review on a multi-step program.
---

# Delegate

On a program of several tickets, plan and write tickets; let subagents investigate, implement and verify. Keep your own context for decisions and review.

## Pick the model and effort

| Work | Model | Effort |
| --- | --- | --- |
| Read-only investigation: inventories, "find every place that…", log digging, spec or backend research | Grok 4.7, or Sonnet | Grok low/medium; Sonnet medium |
| Implementation ticket | Grok 4.7 | high; xhigh for subtle or cross-cutting changes |
| Deep correctness review of a PR or design | Fable or Opus ("Claude" provider), or Grok 4.7 | high; xhigh for Grok |

Claude usage is scarce and Grok usage is plentiful: send routine work to Grok or Codex, not Claude subagents.

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

Use worktree isolation when tasks edit files in parallel or the main checkout is in use; merge their commits yourself.

## Watch it

- Check every ~5 minutes (`task_status`, or `t3_thread_read` for `updatedAt`). Don't wait only for the completion notice.
- No activity for 10 minutes: cancel and take over, or re-delegate a smaller ticket.
- Steer a running task with `t3_thread_send` (mode `steer`) when requirements change mid-task.
- A "completed" task may have no final message: check its worktree (`git log`, `git status`, the proof file) before trusting or re-running it.

## Verify before you merge

Read the diff and the proof file yourself. Re-run the checks on the target branch after merging (dependencies or master may have moved). Never report a subagent's claim as verified until you have seen the evidence.
