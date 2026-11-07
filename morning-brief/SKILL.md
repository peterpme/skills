---
name: morning-brief
description: Daily status run for Peter's PRs, tickets and ledger. Reads every open PR of his across his work org and personal repos, applies the merge and 14-day rules from the global instructions, keeps the ledger epics current, and posts one comment a day on the pinned brief issue with only the decisions no rule covers. Use for the scheduled Morning brief run, or when asked where his PRs stand or what needs him.
compatibility: macOS or Linux with gh authenticated as Peter and the private home repo cloned at ~/Projects/home.
---

# Morning brief

Goal: Peter reads one comment a day and never has to ask where anything stands. Everything you write is a decision only he can make or a fact he would otherwise ask for. You act on every rule yourself; you never hand him work a rule already decides.

## Sources, in this order

1. `git -C ~/Projects/home pull --ff-only`.
2. The rules you enforce: `~/skills/global/AGENTS.md`, the "Merging by repo class" line, the tiers, and "Where state lives". Read them each run; they change.
3. The ledger layout: `~/Projects/home/docs/agents/README.md`. The pinned issues there are "Morning brief" (your output) and "Backlog: closed PRs with branches kept" (where every closed PR goes).
4. Yesterday's brief comment, so you repeat an item only when its state changed.

## Gather

With `gh ... --json ... --jq`, for the GitHub user `peterpme`:

- Open PRs across his work org and `peterpme/*`: state, draft, CI, human reviews (bots excluded), age, idle days, blocker.
- PRs merged or closed in the last 24 hours, by anyone.
- Comments and reviews others left on his PRs or on issues he opened.
- Each open `epic` issue in the home repo, and whether its status section is older than the PRs it lists.
- Linear, if its MCP tools are present in this thread: his assigned and created issues in the "agentic era" project, and those updated by someone else in the last 7 days. If the tools are absent, one line: "Linear not connected. Run `claude mcp login linear-server` in a terminal on the laptop."

## Act, before writing

Apply the merge rule exactly as the global instructions state it that morning. Merge what it says to merge, close what it says to close, one status comment each, branch kept on a close. Add every closed PR as a row in the Backlog issue with its branch and head commit. Record a merge or close on the matching epic when one exists. Never deploy. Never nudge a teammate; name who should be asked and why.

## Write

One comment on the Morning brief issue, in this order:

1. **Needs you**: at most 5 items, each with the exact step, and only decisions no rule covers.
2. What you merged or closed, one line each.
3. A table of PR counts by state, with a detail column.
4. Changes since yesterday.
5. Epics whose status is stale, fixed with a comment on the epic, not here.

Create no new issue except for a finding that fits no epic. Then reply in the thread with one line: the comment link, the number of needs-you items, and the number of PRs merged or closed. Stop.

## Setting it up on a machine

A T3 scheduled task at 07:30 local, new thread per run, prompt: `Run the morning-brief skill: read ~/skills/morning-brief/SKILL.md and do one run. If the skill file is missing or gh is not authenticated, reply in one line starting with "Needs your call:" and stop.`
