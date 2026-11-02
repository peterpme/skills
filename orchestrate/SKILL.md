---
name: orchestrate
description: Ask once, get finished PRs. Turns a build request into a written contract (Peter's goal, his decisions, acceptance checks, slices, defaults for open questions), has it reviewed once by the other model family, builds through workers, reviews each diff by risk, and hands over only PRs that pass a ready gate. Use for a feature, fix or refactor that needs a PR and more than one file, for multi-PR programs, and whenever you coordinate several workers. Not for a one-file fix (finish-task) or one-off research or review (delegate).
---

# Orchestrate

Peter's goal: ask once, get finished PRs. Every time he has to say "no", "I said", "status?" or "resolve the comments", the work failed even if the code is right. This skill turns his request into a written contract, holds everyone to it, and stops unready work from reaching him.

| Task size | Do |
|---|---|
| Small fix, one file, obvious proof | `finish-task` only |
| One PR | Contract (steps 1 and 2), build, diff review, gate |
| Several PRs or several workers | All steps, and you only orchestrate |

## 1. Write the contract before any code

Save it as `.verification/<task>/CONTRACT.md` in the worktree. Every brief, review and report points at this file. Re-read it after `/compact` or a resume, before acting.

On a program with several workers, keep your context for decisions: have a read-only worker do the repo investigation and draft the contract from Peter's words, then check the draft against his request and decide. For a single PR, write it yourself.

1. **Goal.** Peter's request, quoted word for word, then one sentence on the outcome he will see.
2. **Decisions.** Every choice already made, each with its source. Look in this order and record what you find:
   - Peter's messages in this thread, including side remarks ("no bignumber", "use tsrs", "exclude Aug 5").
   - The repo's `AGENTS.md`/`CLAUDE.md`, contributing and PR guides, and the docs for the area you are changing.
   - Earlier threads and PRs on the same topic: `t3_thread_search`, `gh pr list --search <topic> --state all`, and review comments on those PRs. A reviewer's past objection is a decision.
   - Peter's global instructions and the skills that apply (`finish-task`, `delegate`).

   Everything the request states explicitly is a decision, and so is what it implies:
   - **Approaches and their order:** try the first one he named before falling back, and say what failed.
   - **Numbers:** workers, reviewers, limits, sizes.
   - **Models and tools.**
   - **Priorities:** which package, platform or flow comes first.
   - **Framing:** an "experiment" or "spike" stays in a new directory on a draft PR and leaves production code alone.

   A decision stands until Peter changes it. Never swap a tool, library or approach he chose for one you prefer. If you think it is wrong, say so once in the report and follow it anyway.
3. **Acceptance checks.** Each one is an input and an action, an observable result, and the exact command or UI path that shows it. The expected result has to come from outside the code you will write: Peter's words, real data, the current behavior, or a spec.
   - Cover every branch of each condition the request names: on and off, each platform he mentions, before and after.
   - For a bug, run the check on the unfixed code first and see it fail, from the same starting state Peter hit (a fresh checkout, empty caches).
   - Include at least one case that would expose a plausible wrong implementation.

   "Tests pass" is a check, not acceptance.
4. **Approach and slices.** The design in a few lines, the files or modules it touches, and the PRs in merge order.
   - **For a bug:** find out why the step that already runs fails, and fix that step. Treat what Peter states as fact ("X always runs first") as a premise to explain, not something to work around. Don't add a new trigger, hook, wrapper or startup layer around a broken step.
   - **Separate PRs:** give these their own PR and never mix them with behavior changes: sensitive packages (security, keys, money, auth), docs and agent instructions, and pure moves or renames. Keep each PR reviewable: about 600 changed lines or fewer, excluding lockfiles, generated files and mechanical renames. For a mechanical change across many files, use or write a codemod (`ast-grep`, `jscodeshift`, a script) and name it in the PR. Each slice must pass CI and work on its own.
5. **Out of scope.** What you will not touch, including tempting cleanups.
6. **Open questions.** Only questions where the answer changes what gets built and neither the request, the repo nor history answers it. Most tasks have none, one or two. Each carries your default and why. Ask them all at once at the start, in one message, then **proceed on the defaults**.

   Never ask Peter to approve the plan, confirm your defaults, or pick between equivalent options. Never wait on routine choices like names, file locations, test layout, or which of two equivalent APIs to use. Decide them, record them as decisions, and act on them.

When Peter adds or changes a decision mid-task, update the contract right away and send it to every running worker (`t3_thread_send`, `mode: "steer"`).

## 2. Contract review, once

Send the contract to one reviewer from the other model family, routed with `delegate`'s table: the GPT reviewer if a Claude model wrote it, the Claude reviewer if GPT wrote it. Give it the contract path, the repo and revision, and the request thread or Peter's words. Ask exactly:

- Which acceptance check is missing, or would pass while the result is still wrong?
- Which part contradicts one of Peter's decisions, the repo's rules, or earlier review feedback?
- Where will Peter most likely reject the result or have to step in? Look at slicing, size, approach, and proof.
- Which open question should have been decided instead of asked, and which decision needed Peter?

Settle each point yourself: accept it and change the contract, or reject it with one line of reasoning. Note it under "Review changes" in the contract. One revision only. No back-and-forth between models: their agreeing proves nothing, and the reviewer's independence is the value.

## 3. Build through workers

On anything with several slices or workers, you are the orchestrator: you write briefs, enforce the contract and run the gate. You do not implement or review code yourself. Take the first slice all the way through the ready gate before starting the rest, so a wrong assumption costs one slice, not all of them. Then keep as many workers running as Peter asked for, refilling a slot as soon as one finishes. Follow `delegate` for routing, briefs and stall checks. Each brief adds:

- the contract path and which slice this is;
- the acceptance checks this slice must show, with expected results copied from the contract;
- "Do not change anything in Decisions or Out of scope. If the slice can't be done within them, stop and report why."

For a single-PR task you may implement it yourself, but still write the contract, get the reviews, and pass the gate.

Long-running commands (builds, migrations, remote jobs) go in the background with a timeout and a log. Never end a turn promising to report later unless something will actually wake you.

## 4. Proof

Each slice's PR body holds a table of each acceptance check, its expected result, the actual result, and the evidence (output, screenshot or record). Expected comes from the contract, actual from running the real flow. A check that couldn't run is `implemented, unverified` with the missing prerequisite. It never counts as a pass.

## 5. Diff review: two independent reviewers

When a slice's CI is green, review it with depth matched to risk:

| Change | Reviewers |
|---|---|
| Deleting dead code, pure moves, docs | One: the GPT reviewer |
| Behavior changes | Two in parallel: the GPT reviewer and the Claude reviewer |
| Security, keys, money or auth | Both at their highest effort, plus a check that only the intended files changed |

Models and efforts come from `delegate`'s table. If Peter named the reviewers or their number, use his. Reviewers never see each other's findings. Give each the PR, the contract, and the commit SHA, and ask for `delegate`'s review reply format: a verdict, then findings with severity, file and line, and the command and output that show the failure. Also ask for contract violations: a decision ignored, scope crept, an acceptance check missing or faked, or a size cap exceeded.

- Rerun each finding's command before passing it on. Drop what doesn't reproduce.
- Fix blockers and should-fix findings. Nits are optional, and declined ones go in the PR body as follow-ups.
- Compare `git diff --shortstat` before and after review. If review made the diff bigger, cut back to what the contract needs before the next round.
- The worker fixes every confirmed finding.
- Each reviewer then re-checks only its own findings against the new SHA, in a new `delegate_task` round with the findings and responses.
- At most two rounds. You decide what is left. Drop pure taste. If a disagreement changes what Peter gets, put it under "Needs your call".
- Address every comment GitHub reviewers and bots leave on the PR: fix it, or reply with the reason. Then resolve the thread.

## 6. Ready gate: nothing reaches Peter before this

A PR is ready only when all of these hold. Check them with the helpers, not from memory:

- `pr-status <n>` exits 0: CI green, mergeable, no unresolved threads (`pr-threads <n>` is empty).
- The proof table is filled in, and every acceptance check for this slice passes or is clearly marked unverified with a reason.
- Both reviewers' findings are fixed or answered, and the reviewed SHA is the PR's head.
- The size is within the cap, or the PR body says why it can't be split.
- The PR body states why it exists, what changed, the proof table, the reviewers with their model and reviewed SHA, and any codemod used.

Never merge on your own: Peter merges, or tells you to in that thread. No reviewer approval counts as that. Then hand over in one message: one line per PR in merge order (`#n title: what it does, proof in one phrase`), followed by "Needs your call" with only what truly needs him, and what is unverified. Draft status and merging follow Peter's global instructions.

## 7. Close out

After a PR merges: settle or close its worker threads, remove their worktrees (`git worktree remove`; `disk-clean` catches leftovers), and delete the remote branch if the repo doesn't do it automatically. Mark the contract done.
