---
name: orchestrate
description: "Use when Peter asks you to build, fix, migrate or refactor something that ends in a PR and spans more than one file (\"build X and get me a pr\", a ticket with acceptance criteria, a migration, a new project), a multi-PR program, or when you coordinate several workers. Writes the contract first. Not for a one-file fix or a one-off investigation (delegate)."
---

# Orchestrate

Peter's goal: ask once, get finished PRs. Every time he has to say "no", "I said", "status?" or "resolve the comments", the work failed even if the code is right.

| Task size | Do |
|---|---|
| Small fix, one file, obvious proof | The Finish steps in global AGENTS.md only |
| One PR | Contract (step 1), build, diff review, gate |
| Several PRs or several workers | All steps, and you only orchestrate |

## 1. Write the contract before any code

Post it on the ticket, which is the source, and keep a working copy at `.verification/<task>/CONTRACT.md` in the worktree for briefs, reviews and reports to point at. Re-read it after `/compact` or a resume, before acting.

On a program with several workers, keep your context for decisions: have a read-only worker do the repo investigation and draft the contract from Peter's words, then check the draft against his request and decide.

1. **Goal.** Peter's request, quoted word for word, then one sentence on the outcome he will see.
2. **Decisions.** Every choice already made, each with its source. Look in this order and record what you find:
   - Peter's messages in this thread, including side remarks ("no bignumber", "use tsrs", "exclude Aug 5").
   - The repo's `AGENTS.md`/`CLAUDE.md`, contributing and PR guides, and the docs for the area you are changing.
   - Earlier threads and PRs on the same topic: `t3_thread_search`, `gh pr list --search <topic> --state all`, and review comments on those PRs. A reviewer's past objection is a decision.
   - Peter's global instructions and the skills that apply (`delegate`).

   Everything the request states explicitly is a decision, and so is what it implies:
   - **Approaches and their order:** try the first one he named before falling back, and say what failed.
   - **Numbers:** workers, reviewers, limits, sizes.
   - **Models and tools.**
   - **Priorities:** which package, platform or flow comes first.
   - **Framing:** an "experiment" or "spike" stays in a new directory on a draft PR and leaves production code alone.

   A decision stands until Peter changes it. Never swap a tool, library or approach he chose for one you prefer. If you think it is wrong, say so once in the report and follow it anyway.
3. **Acceptance checks.** Open with one sentence naming the proof Peter would trust without reading the code, such as "the built app matches the reference library byte for byte on each operation"; the checks deliver it. Then two blocks, with expected results from outside the code you will write: Peter's words, real data, the current behavior, or a spec.
   - **Verification**, did we build it right: numbered checks, each an input and an action, the expected value, and the exact command or UI path that shows it. Cover every branch of each condition the request names: on and off, each platform he mentions, before and after. Include at least one case that would expose a plausible wrong implementation. For a bug, run the check on the unfixed code first and see it fail, from the same starting state Peter hit (a fresh checkout, empty caches).
   - **Validation**, did we build the right thing: one scenario through the real flow with real data, as Peter would use it. When parallel PRs touch one feature, run it on the combined branch, not on each PR alone.

   Someone other than the authoring agent runs both blocks against the pushed branch: you, a reviewer or CI. The author's report is never the evidence.
4. **Approach and slices.** The design in a few lines, the files or modules it touches, and how the working change splits into PRs for review, in merge order. The split is a plan, not the starting shape: the build starts as one draft PR (section 3).
   - **For a change meant to move a number** (speed, size, jank, flakiness, cost): follow `harness-first`. The harness or committed baseline is its own PR, opened before the optimization work, and the one exception to starting as one draft PR.
   - **For a bug:** find out why the step that already runs fails, and fix that step. Treat what Peter states as fact ("X always runs first") as a premise to explain, not something to work around. Don't add a new trigger, hook, wrapper or startup layer around a broken step.
   - **For a change to shared code:** list its blast radius: who imports it, which flows run through it, and which of those flows have no automated check today. Each unchecked flow gets a Verification check or an unverified proof row.
   - **Separate PRs:** give these their own PR and never mix them with behavior changes: sensitive packages (security, keys, money, auth), docs and agent instructions, and pure moves or renames. Keep each PR reviewable: under 400 hand-written changed lines, excluding lockfiles, generated files and mechanical renames. `pr-status` counts it and exits 3 over 400; a PR that truly can't be split carries a body line starting `Unsplittable: <reason>`. For a mechanical change across many files, use or write a codemod (`ast-grep`, `jscodeshift`, a script) and name it in the PR. Each slice must pass CI and work on its own.
5. **Out of scope.** What you will not touch, including tempting cleanups.
6. **Open questions.** Only questions where the answer changes what gets built and neither the request, the repo nor history answers it. Most tasks have none, one or two. Each carries your default and why. For a feature, design or multi-PR request, ask them as one `grilling` round (at most three) and wait for Peter's answers, unless he said figure it out yourself or no one is there.

   Never ask Peter to pick between equivalent options. Decide routine choices (names, file locations, test layout, equivalent APIs) yourself, record them as decisions, and act on them.

When Peter adds or changes a decision mid-task, update the contract on the ticket and in the copy right away and send it to every running worker (`t3_thread_send`, `mode: "steer"`).

## 2. Check the contract yourself

Check the contract against Peter's words and the repo's rules, then build. No model reviews it: agreement between models is not evidence, and Peter's veto window is the contract review.

## 3. Build through workers

On anything with several slices or workers, you are the orchestrator: you write briefs, enforce the contract and run the gate. You do not implement or review code yourself. Start every build as one draft PR holding the whole change and get it working there; workers build onto that one branch, and a slice is a unit of work, not a PR, until the split. Split the draft into the contract's PRs only once it works, and only as far as review needs; never open a stack of draft PRs up front. Then take the first split PR all the way through the ready gate before handing over the rest, so a wrong assumption costs one PR, not all of them. Handing over a PR does not end the program: hand over the next in the same turn, stacked on the previous branch if it depends on it, and never wait for a merge or for Peter to say "next". The program ends when the ticket's last PR passes the gate or Peter stops it. Then keep as many workers running as Peter asked for, refilling a slot as soon as one finishes. Follow `delegate` for routing, briefs and stall checks. Each brief adds:

- the contract path and which slice this is;
- the Verification checks this slice must show, with expected results copied from the contract, and the Validation scenario if this slice completes the feature;
- "Do not change anything in Decisions or Out of scope. If the slice can't be done within them, stop and report why."

Run builds, migrations and remote jobs in the background with a timeout and a log.

## 4. Proof

Each slice's PR body holds a table with a row per acceptance check, grouped by operation (each flow, command or endpoint, not each function): expected result, actual result, rung, and evidence. Expected comes from the contract, actual from running the real flow. Rungs: 0 compiles and lints, 1 unit test of pure logic, 2 real flow in a dev runtime, 3 real flow in the shipped runtime, the minimum for anything a user touches, 4 an independent oracle sharing no code with the change, for signing and money, 5 before-and-after measurement, for any change meant to move a number. Rungs 0 and 1 never prove a change alone. Every operation in scope gets a row; one with no check is marked `implemented, unverified` with the missing prerequisite and never counts as a pass.

Each test names the user-visible rule or bug it protects in its title ("an expired quote cannot be accepted") and runs through the public API, so it changes only when a requirement does. Cut tests that echo the code, such as one per state transition or a mock asserting it was called. A count of tests, paths or transitions is never evidence; name the rules. For a mechanical change, the proof is the codemod's check mode reporting zero remaining matches, or an emit-equivalence check showing the build output unchanged.

## 5. Diff review: findings only

Review is not proof. One reviewer per slice, and only a finding that comes with a failing command counts: the command, its output, and the file and line. A finding without one is a note; drop it unless it is a contract violation below.

| Change | Reviewer |
|---|---|
| Deleting dead code, pure moves, docs | None beyond CI |
| Behavior changes | One: the GPT reviewer |
| Security, keys, money or auth | One at its highest effort, plus a check that only the intended files changed |

Models and efforts come from `delegate`'s table. Give the reviewer the PR, the contract, and the commit SHA, and ask for `delegate`'s review reply format, each finding with its failing command. Also ask for contract violations, each a blocker:

- a decision ignored, scope crept, an acceptance check missing or faked, or a size cap exceeded;
- a test rerun until green, or a retry added to a test or CI step, instead of a fix for the flake;
- an assertion edited or deleted in a refactor or bug fix without a changed requirement the contract names;
- a bug fix without a test that fails on the old code and passes on the new, both runs shown in the PR;
- a speed, latency, memory or size claim without a before and after number (`perf-claim <n>` exits 1).

- Fix blockers and should-fix findings. Nits are optional, and declined ones go in the PR body as follow-ups.
- Compare `git diff --shortstat` before and after review. If review made the diff bigger, cut back to what the contract needs before the next round.
- The reviewer then re-checks only its own findings against the new SHA, in a new `delegate_task` round with the findings and responses.
- At most two rounds. You decide what is left. Drop pure taste. If a disagreement changes what Peter gets, put it under "Needs your call".

## 6. Ready gate: nothing reaches Peter before this

A PR is ready only when all of these hold. Check them with the helpers, not from memory:

- `pr-status <n>` exits 0: CI green, mergeable, no unresolved threads (`pr-threads <n>` is empty) after the review bots have commented on the head SHA. Exit 9 means a tier 2 PR is inside its two hours after the contract: it stays a draft.
- `perf-claim <n>` exits 0: no performance claim, or both numbers are in the body.
- The proof table covers every operation in scope, and every acceptance check passes or is marked unverified with a reason.
- The reviewer's findings are fixed or answered, and the reviewed SHA is the PR's head.
- No contract violation from step 5 is open. A bug fix with no fail-before, pass-after test goes back to the worker.
- The size is within the cap (`pr-status` shows the count), or the PR body has an `Unsplittable: <reason>` line.
- Its base is `master` (or the repo's default branch). A stacked PR stays a draft while it targets a sibling branch, even after its veto window; run the gate once its parent merges and GitHub retargets it. A mechanical refactor across many operations is one PR per operation only when each is reviewable alone and the stack stays under about five deep; otherwise fold.
- The PR body states why it exists, what changed, the proof table, the reviewer with model and reviewed SHA, and any codemod used.

Merging follows the repo-class rule in the global instructions; no reviewer approval stands in for Peter's merge on a work repo. Then hand over in one message: one line per PR in merge order (`#n title: what it does, proof in one phrase`), followed by "Needs your call" with only what truly needs him, and what is unverified.

## 7. Close out

After a PR merges: settle or close its worker threads, remove their worktrees, and delete the remote branch if the repo doesn't do it automatically. Mark the contract done.

## LLP: pointers on every task, review by what a mistake costs

LLP is numbered design docs in a repo's `llp/` folder plus `@ref` comments in code that point at them. In a repo that has `llp/`:

- **Pointers, every tier.** Run `llp-orient` before the contract and record what it returns as Decisions. When code implements a recorded decision, leave the `@ref`. When the diff touches code that carries one, run `llp-maintain pre-pr` before the gate.
- **Review of an LLP document** follows LLP 0005: proportional to what a mistake would cost, with no quota.

| Stakes | Review |
|---|---|
| Easily reversed: tier 0 and tier 1 | Your own critical read. No review loop; skipping it is a legitimate choice, not a shortcut |
| A bounded design with real trade-offs: tier 2 | `llp-review`, one round from the GPT reviewer. A finding counts when it names a wrong decision and the case that breaks it; a demand for more detail does not |
| Foundational: what the code will grow around, or is expensive to reverse | `llp-super-refine`, only when Peter asks for it by name |

Never start a review loop on day-to-day work because a document exists. Whatever the level, a review that did not run is never claimed.
