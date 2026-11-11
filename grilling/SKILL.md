---
name: grilling
description: "Use at the start of a new feature, design, new system or \"what if we...\" request, or when Peter says grill me or ask me first: interview him, at most three questions a round, each with your pick, until no answer would change the build. Not for a bug with a repro, a ticket with acceptance criteria, or a hill climb with a harness."
---

# Grilling

Pocock's `grilling` ([upstream.md](upstream.md): mattpocock/skills@4ae2317 `skills/productivity/grilling/SKILL.md`, byte for byte, MIT in LICENSE; never edit it) on a two-week trial from 2026-11-08. Read upstream.md for the method: the design tree, the frontier, rounds, the question format, facts are yours and decisions are Peter's. The rules below beat it wherever they conflict.

## When to grill

| Request | Grill? |
|---|---|
| New feature, design, system, "what if we..." | Yes |
| Greenfield in a domain no skill covers | Yes, after research |
| Spans more than one PR | Yes; slicing is a decision |
| Ops or infra change | One round: blast radius and rollback |
| Bug with a reproduction | No. Reproduce, then fix |
| Ticket with acceptance criteria | No. Check the criteria are checkable, then build |
| Hill climb with a harness | No. The harness is the spec |

## Overrides

1. **Explore before the first question.** Read the request, the repo's agents file and docs, the code it touches, earlier threads and PRs on the topic, and the ledger. A question any of them answers is a fact: record it as a decision with its source and never ask it.
2. **At most three questions per round, counting every question in the message.** Logistics (which ledger, credentials, remotes, which repo) count too. Of the frontier, ask the three whose answers most change what gets built. Every other open branch gets your default, written into the contract as a decision.
3. **Each question carries a default and the trade.** Under upstream's `➡️` line, give each option's main gain and cost in plain words, one line each. Word it so "yes" takes the default.
4. **Wait for Peter's answers.** He fires off a task and stays for a few minutes, and sometimes finds out what he wants by answering. After his answers, write the contract and build. Go on your defaults only when he said "figure it out yourself" or no one is there (rule 7).
5. **Stop when no answer would change the build.** That ends the session, not an empty frontier. Most requests need one round; many need none. A second round only for branches Peter's answers opened.
6. **The output is the contract**, written by `orchestrate` step 1: questions asked go under Open questions with their defaults, answers become Decisions. No transcript.
7. **No Peter in the loop** (scheduled or headless run): post the round on the ticket and go on the defaults.
