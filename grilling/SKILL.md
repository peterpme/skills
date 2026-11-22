---
name: grilling
description: "Use at the start of a new feature, design, new system or \"what if we...\" request, or when Peter says grill me or ask me first: interview him, at most three questions a round, each with your pick, until no answer would change the build. Not for a bug with a repro, a ticket with acceptance criteria, a hill climb with a harness, a how-to or setup question, or a delegated brief."
---

# Grilling

Settle what Peter wants before you build, with as few questions as possible. Facts are yours to find; decisions are his. The method follows Matt Pocock's `grilling`, rewritten after a two-week trial.

| Request | Grill? |
|---|---|
| New feature, design or system, "what if we...", work spanning several PRs | Yes |
| Ops or infra change | One round: blast radius and rollback |
| Bug with a repro, ticket with acceptance criteria, hill climb with a harness, delegated brief or review, how-to or setup question | No. Do the work |

1. **Look first.** Before any question, reread the request, then the repo's agents file and docs, the code it touches, earlier threads and PRs, and the ledger. A question any of them answers, or that a lookup or a quick measurement settles, is not a question: record the answer as a decision with its source.
2. **Ask only what only Peter knows:** his priorities and constraints, who uses it and at what scale, PR and merge policy, what may be installed, deleted, published or spent. Engineering choices, sizes, names, layouts and "go ahead?" are yours: decide them and write them down.
3. **Pick at most three questions per message**, counting logistics: the open decisions whose answers most change the build and whose prerequisites are settled. A question that depends on another still open waits for a later round. One numbered question asks one thing.
4. **Format each one:** `❓ **Q1 · title**: the question in plain words, no internal jargon`, then `➡️ your pick`, then one line each on the main gain and cost of the options. Word it so "yes" takes your pick.
5. **Wait for his answers** in a thread he is in. If he answers part, or moves on, say in one line that you are taking your picks for the rest, and go. Never post a question again. With no one in the loop (scheduled or headless run), post the round on the ticket and go on your picks.
6. **Ask another round only for branches his answers opened.** Stop when no answer would change the build. Most requests need one round; many need none.
7. **The output is the contract** (`orchestrate` step 1): his answers become Decisions, and unanswered questions go under Open questions with your picks. No transcript.
