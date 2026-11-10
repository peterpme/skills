---
name: llp-maintain
description: "Keep an LLP corpus in sync with its code. Detects code/doc drift, validates @ref annotations interactively, checks provenance tags, and proposes reconciliations, ref repairs, status changes, and overlay changes. Modes — pre-pr, audit, reconcile, retire-proposal, curate (the promote → archive → realign pass). Proposes; never applies."
source: ccheever/llp@v0.5.2
---

# llp-maintain

<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0004-design-principles.principles.md — co-evolution and living documents, the model this operationalizes -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0000-linked-literate-programming.explainer.md#6-validation-ref-check — the deterministic subset lives in ref-check, not here -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0011.000-curation-pass.guide.md — the curate intent follows this procedure -->

The upkeep engine. Living documents rot into misleading guidance unless code and docs co-evolve; this skill finds the drift and **proposes** fixes. The propose-only line is what lets one skill cover four maintenance moments without becoming a mega-skill.

Invoke as `/llp-maintain --intent <pre-pr | audit | reconcile | retire-proposal | curate>` (each has a sensible default scope).

## Trigger

Before opening a PR (`pre-pr`, the common case); periodically or on suspicion (`audit`); after a pull or against a branch (`reconcile`); "this doc looks done/stale" (`retire-proposal`); after design work lands, before a release, or on cadence (`curate`).

## Invariants

- MUST propose, never apply: no edit, ref repair, or status change without sign-off. Output is a reviewable checklist or diff, never a mass rewrite.
- MUST NOT classify untagged rationale claims silently — flag them for the author to mark `[observed]`/`[confirmed]`/`[inferred]`.
- `curate` MUST run its three verbs in order — promote, archive, realign — and MUST realign the code only against `llp/foundation/`, never against the whole corpus. Promotion proposals MUST apply LLP 0000's admission test (design recreatable from the set; set-level; too-small fails), not importance.
- MUST NOT claim to be a CI gate. The deterministic, merge-blocking checks are `ref-check`'s job; this skill is the interactive, judgment-bearing complement.

## Checks

For `@ref`s in scope: **broken** target/anchor (error — list the anchors that *do* exist); **tombstoned/superseded** target (warning, note the replacement); **stale gloss** (hint); **orphaned** annotation whose attached construct is gone (warning). For provenance-tagged docs: `[inferred]` in `Accepted`/`Active` (error); `[observed]` without a stated location, or `[confirmed]` without name+date (flag for the author). For installed skills: a `source:` pin that lags upstream releases (note, when network allows). Beyond the mechanical: code whose behavior no longer matches the section it references; new files implementing a documented LLP with no `@ref`; LLP sections the diff contradicts.

## Modes

| Intent | Default scope | Artifact |
|---|---|---|
| `pre-pr` | working tree | co-evolution checklist ("update doc or code" / "repair ref" / "consider annotating") + proposed status changes, **not applied** |
| `audit` | corpus | findings list: drift, broken refs, stale statuses |
| `reconcile` | diff range / branch | per-doc reconciliation proposals (or "the code drifted, not the doc") |
| `retire-proposal` | one named doc | a drafted `Superseded`/`Tombstoned` proposal with rationale (a status change in the header — files never move) |
| `curate` | overlays + foundation vs. code | the PROMOTE / ARCHIVE / REALIGN checklist of LLP 0011.000: links to add or remove, folds, status fixes, and code changes foundation now demands |

## Hand-offs

- A reconciliation that is really a new design decision → `llp-review`.
- Broken refs surfaced by `llp-orient` land here for repair proposals.
- A stale `source:` pin noted by `audit` → `/llp-adopt update` applies the update after an approved diff (this skill never applies).
- Deterministic CI enforcement → `ref-check`.
