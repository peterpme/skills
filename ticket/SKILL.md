---
name: ticket
description: "Use when Peter wants something kept for later instead of done now: \"ticket\", \"issue\", \"file this\", \"add to the backlog\", \"ask me later\", or a ticket per item in a list. Files it in GitHub or Linear. Not for existing issues."
compatibility: gh authenticated as peterpme; the private home repo cloned at ~/Projects/home.
---

# Ticket

Peter types one line; you file one issue and reply with its link. No questions back unless the home of the issue is ambiguous (work versus personal), and then one question with your pick.

## Where it goes

- Work (Backpack, the wallet, exchange, bpx-*): Linear, team MOB, project "Agentic Era" unless he names another. Use the Linear MCP tools; if they are absent, file it in home with the `linear-mirror` label and say so.
- Everything else: `peterpme/home` issues.

## Shape

1. Read `~/Projects/home/docs/agents/README.md` for the labels (one area: `backpack` or `personal`; one project: `wallet` `exchange` `sec-parser` `peterbot` `infra` `skills` `blog` `dotfiles`; one shape: `epic` `finding` `decision` `learnings` `playbook`). Create no new label.
2. Check for a duplicate first: `gh issue list -R peterpme/home --search "<key words>" --state all --limit 5`. If one exists, comment the new detail there instead and reply with that link.
3. Title: what finished looks like, in his words, under 80 characters.
4. Body, in this order, each a short line or bullet:
   - What he asked, verbatim in quotes if it was short.
   - **Done when**: 2 to 5 checks a stranger could run.
   - **Context**: links to the PRs, threads, docs or epics it touches. Never T3 thread ids in a public repo.
   - Tier 0, 1 or 2 by blast radius (global instructions, "Tiers").
5. A question only he can answer becomes a `decision` issue: assigned to `peterpme`, options as code spans, your pick and why, the one-word reply he can send. Nothing else is assigned to him.
6. Every body and comment ends with `<!-- agent -->` on its own line.
7. If it belongs under an open epic, mention the epic in the body and add one line on the epic pointing at the new issue.

## Reply

One line: the link, the labels, and "decision" if it is one. Nothing else.
