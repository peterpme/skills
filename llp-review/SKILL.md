---
name: llp-review
description: Run the LLP 0005 review loop for an LLP document — orchestrate reviews from other model families, write one provenance-tracked artifact per review actually received under llp/reviews/, and never fabricate a review or accept on the author's behalf. Review intensity scales with stakes; the author decides when it's enough.
source: ccheever/llp@v0.5.2
---

# llp-review

<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0000-linked-literate-programming.explainer.md#review-honesty — the rules this enforces -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0005-rfc-process.guide.md#review-artifacts — artifact + provenance header format -->

Review an LLP the way LLP 0005 prescribes: as much critical review as the stakes warrant, captured honestly. Different model families catch different blind spots, so a single session cannot stand in for a multi-family loop — this skill makes the honest path the only path.

Invoke as `/llp-review <number | slug | filename>`. Bare: list `Draft`/`Review` LLPs and ask.

## Trigger

A document enters `Review` (the author's opt-in to a formal loop), or review is explicitly requested. Otherwise *offer* review scaled to stakes (LLP 0005 §How much review to buy) — don't impose it.

## Invariants

- MUST NOT fabricate a review, record one that wasn't actually provided, or mark a loop complete by intent.
- MUST NOT count the session that authored the draft as an independent reviewer — if this session wrote the document, say so and gather reviews elsewhere.
- MUST NOT change `**Status:**` or accept/reject — propose transitions; the author decides.
- MUST write one artifact per review actually received: `llp/reviews/NNNN-slug.<family>.md`, opening with the LLP 0005 provenance header (family · provider/runtime · date · redacted? · method). Re-reviews by the same family get a dated section, never an overwrite.
- MUST NOT send content to an external provider without an explicit human action; redact secrets by default.

## Workflow

> **Recipe (advisory)** — locate and read the document fully. If this session can act as one independent family reviewer (and didn't author the draft), write that review using the LLP 0005 standard prompt. For each further input the author wants — pasted manual review, sub-agent on a different family, CLI runner — prepare the prompt and **stop until it is actually provided**. Structure each review body: overall assessment · strengths (cite sections) · concerns (with severity and what would resolve each) · suggestions · open questions · recommended next step.

## Artifact

Review files under `llp/reviews/` with provenance headers, plus a summary of the feedback and a *proposed* next step (revise and stay `Draft` / gather another family / ready for the author to accept).

## Hand-offs

- Feedback that amounts to a new design direction → a fresh LLP via `llp-create`.
- The author applies status changes; this skill never does.
