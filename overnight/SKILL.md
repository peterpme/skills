---
name: overnight
description: Work a task through the night while Peter sleeps - never wait for him, think each open question through and decide it yourself, record every decision as a closed decision issue with its one-word undo, finish the work, and leave one morning summary on the Morning brief. Use when Peter types /overnight <task>, says he is going to sleep and to figure it out, or for the scheduled Worker's runs.
---

# Overnight

Peter's words: "a skill called nightwatch or overnight and that will force the model to think more and figure it out on its own bc I'm sleeping and record every decision". This is his "figure it out yourself": the alignment rule in `global/AGENTS.md` (Align before you build) is switched off for this task, and nothing waits for him until morning.

## Models

| Work | Model | Effort |
|---|---|---|
| The plan and every decision (this thread) | `claude-opus-5-5` | high |
| Implementation children | from `delegate`'s table | as there |
| Review, one per PR | Sol, `gpt-6.1-sol` on `codex` | high |

If this thread is not Opus 5.5 at high, start one `delegate_task` child at that setting with this skill and the task, and relay its result.

## Start

1. File or find the ticket, as every task does (`start-task`). Write the tier and "overnight" in its start comment.
2. Explore before deciding: the request, the repo's agents file and docs, the code it touches, earlier threads and PRs, the ledger. What they answer is a fact, not a decision.

## Decide instead of asking

For every question you would have asked Peter:

1. Think it through: the two or three real options, what each costs and gains here, and what Peter has decided before on the same kind of call (`docs/feedback.md` and closed `decision` issues in home).
2. Pick one. Prefer the option that is easiest to undo when the evidence is even.
3. Record it: a `decision` issue in home, closed at once, labelled `decision` and the project label, with the question, the options with gain and cost, your pick and why, and the line `Undo: reply <word>` naming the one word that reverts it. Body ends with `<!-- agent -->`. Link it from the task's ticket.
4. Build on it.

A call that only Peter can make and that cannot be undone in the morning (a production deploy, rotating keys, deleting data that has no copy, sending something to other people) is not made overnight: skip that part, finish everything else, and put it first in the morning summary.

## Do the work

- Tier 1 and 2: `orchestrate` from the contract on, with your recorded decisions as its Decisions.
- Every change ends with the Finish steps in `global/AGENTS.md`. Merging follows the repo-class rule: personal repos merge once the ready gate passes; work-repo PRs stay drafts for Peter.
- Long builds and evals go under `bgjob` and are waited on inside the turn. A dead end gets two other approaches before it is reported as blocked; then move to the rest of the task.

## Morning summary

When the work ends, comment once on the Morning brief, home #36, with `ledger-comment 36 <file>`:

```
### Overnight · <MM-DD> · <ticket link>
**TLDR:** <does it work; what is left>

| Decision | Pick | Undo |
|---|---|---|
| [#n question](link) | pick | `word` |

**PRs:** #n merged / #n draft for review, each with its proof in one phrase
**Unverified:** what, and why
**Needs you:** only what could not be decided overnight
```

Then the task's final reply is the same summary.
