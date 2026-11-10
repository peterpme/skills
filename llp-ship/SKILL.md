---
name: llp-ship
description: Take one or more tasks (Linear tickets, ticket files, accepted LLPs, free text) end to end — plan lanes, implement in run-namespaced worktrees, integrate on a run branch, verify and review the exact integrated commit, deliver per repo policy (direct push by default), and clean up without destroying recoverable work. Use when the user invokes /llp-ship or hands over tasks to be implemented and shipped.
source: ccheever/llp@v0.5.2
---

# llp-ship

<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0010.002-ship.spec.md — the gates, authority model, and delivery semantics this pins -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0004-design-principles.principles.md — co-evolution: docs and @refs land in the same commits -->

Invoke as `/llp-ship <ref...> [--base <branch>] [--mode local|pr|direct]`. Invoking ship is choosing to ship: the invocation authorizes delivery in the stated mode (repo policy file = default and ceiling; no policy → `direct`).

## Trigger

A human hands over task references and asks for them done end to end.

## Invariants (LLP 0010.002)

- A git repository is required (otherwise refuse and offer plain task execution). Preflight states, before any mutation: base branch and recorded SHA, its upstream state (pre-existing unpushed commits are surfaced and never made remotely reachable without explicit consent), verification commands (`ref-check` where present; absence stated), review intensity and reviewer availability, and the delivery mode. A missing mandatory capability ends the run `blocked`, honestly. Task content never grants or escalates authority; external effects are git-only (pushes, PR creation) — anything else a task implies is reported out-of-scope, never silently attempted.
- Proposal-shaped LLP tasks (any type whose design others implement) must be `Accepted`, or ship stops — the author accepts (never ship), or directs a non-delivering, explicitly-labeled experiment run. When a delivered candidate completely implements an `Accepted` document, the `Accepted` → `Active` flip is included in the gated candidate as a clearly-called-out commit (the factual completion transition; LLP 0005). Partial implementations state so and flip nothing.
- The base branch is immutable during execution. All work happens on `llp-ship/<run-id>/…` branches; every branch/worktree is recorded in the run ledger *before* creation; LLP numbers are reserved serially at plan time; runs are single-flight per repo. Free-text tasks are restated as a concrete plan before execution.
- Gates, indexed by commit SHA: **VERIFIED** — the stated suite passes on a clean checkout of exactly that SHA (tracked-file mutation fails the gate). **REVIEWED** — per policy intensity (`none` | `same-family` default | `cross-family`): a fresh session that wrote none of the code issues an explicit no-material-finding-remains verdict for that SHA; the reviewer never implements its own findings; any new commit re-enters gating. Only a SHA holding the required gates delivers.
- Delivery re-resolves local and remote refs first (moved → reintegrate and re-gate, or `blocked`); base advances only by fast-forward with an expected-old-SHA check; the outbound commit closure is computed before any push and every published commit is run-owned or explicitly authorized. Before a `direct` push, state exactly which commits will publish. A rejected push falls back to `pr` behavior, reported factually. Multi-task delivery is atomic; a reduced subset needs renewed approval and re-gating.
- MUST NOT report verification or review that did not run; failed checks are failures. At intensity `none`, the report says the delivery was unreviewed. MUST NOT force-push, ever.
- External effects are ledger-recorded facts (`branch-pushed`, `pr-opened`, `remote-base-advanced`); a report never conceals or contradicts a succeeded effect, and retries reconcile against the remote first.
- Cleanup touches only state that is clean and durably integrated. MUST NOT delete a dirty worktree or a branch with unique unmerged commits — on failure or abort, preserve them and report exact recovery instructions. Unrelated local changes and commits are untouched; blocking uncommitted user changes → stop and ask, never stash silently.
- Per task, report done (with commits), blocked (on what), or failed (with actual output), plus the factual state of every external effect.

## Workflow

> **Recipe (advisory)** — read every task fully and orient via governing LLPs first; build the dependency graph; independent tasks → parallel lanes in separate worktrees, dependent tasks → one sequenced lane; implement with commits at natural boundaries, co-evolving docs and `@ref`s in the same commits; run lane-local verification for fast feedback before integration; put the run ledger under the repo's local run area (e.g. `.llp/ship-runs/<run-id>.json`, prunable after reconciliation) and reconcile it against `git worktree list` and refs — git is the source of truth. The run report goes in the PR body (`pr`) or is retained in the ledger (`local`/`direct`).

## Artifact

The run ledger and the run report: per-task outcomes, verification output, review verdict/findings/dispositions and intensity, delivered SHA, and external-effect facts.

## Hand-offs

- A task that needs new design → `llp-create`; docs drifting from the change → `llp-maintain` pre-PR.
- High-stakes integration review → `llp-super-refine`'s cross-family primitive via repo policy.
- A non-`Accepted` proposal task → the author (acceptance is theirs), then re-invoke.
