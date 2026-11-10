---
name: llp-create
description: Create a new LLP document with the next available number (top-level NNNN or a dotted sub-LLP under a parent), the NNNN-slug.type.md filename convention, and a scaffolded metadata header, linked into llp/current/ — or extend an existing LLP when one already covers the topic.
source: ccheever/llp@v0.5.2
---

# llp-create

<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0000-linked-literate-programming.explainer.md#1-llp-documents — numbering, metadata, types, statuses -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0008-distributed-agent-skills.rfc.md#the-skills--core-five-plus-flags — skill contract -->

Author one LLP in a corpus that already exists. Handles numbering, filename, and the metadata scaffold so the author can focus on content.

Invoke as `/llp-create <title>`, `/llp-create --under NNNN <title>` for a sub-LLP, or bare and the skill asks.

## Trigger

"Capture this decision" / "write an LLP for this" — during or after a design conversation.

## Invariants

- MUST check for a covering document first: `Grep` the `**Systems:**` and `**Related:**` headers across `llp/` and propose *extending* an existing LLP over creating a new one when the topic is already covered.
- MUST derive the next number as `max(ever allocated) + 1` — top-level `NNNN`, or for a sub-LLP of `P`: `P.` + `max(ever allocated children of P) + 1` as three digits (`000` if none) — where "ever allocated" scans all of `llp/` recursively (excluding `current/`, `foundation/`, `reviews/`) **and** history for deleted documents (`git log --all --diff-filter=D --name-only -- llp`). Numbers are never reused, never invented, and a parent must already exist.
- MUST name the file `NNNN(.NNN)*-slug.type.md` with the lowercased type matching the header's `**Type:**`, put the full dotted number in the title, and start every new LLP as `Draft`.
- MUST link the new document into `llp/current/` with a relative symlink (`mkdir -p llp/current && ln -s ../<file> llp/current/<file>`; on a checkout without symlink support, a regular file containing `../<file>` is equivalent) — new work is in the working set by definition (LLP 0000 [Current and foundation](https://github.com/ccheever/llp/blob/v0.5.2/llp/0000-linked-literate-programming.explainer.md#current-and-foundation)).
- MUST propose a sub-LLP, not a new top-level number, when the document refines, specifies, or plans an existing LLP (spec for an RFC → `NNNN.000-….spec.md`). Never re-parent by renaming.
- MUST NOT overwrite an existing file — if the name collides, stop and ask.
- MUST NOT silently pick a document type when the choice is ambiguous — propose one and confirm.

## Workflow

> **Recipe (advisory)** — next top-level number: `{ find llp -name '[0-9]*.md' -not -path 'llp/reviews/*' -not -path 'llp/current/*' -not -path 'llp/foundation/*'; git log --all --diff-filter=D --name-only --format= -- llp; } | grep -oE '(^|/)[0-9]{4}' | grep -oE '[0-9]{4}' | sort -n | tail -1` (+1); next child of `0011`: same pipeline with `0011\.[0-9]{3}` (+1, or `000`). Slug: lowercase, non-alphanumerics → `-`, collapse repeats, keep it under ~6 words. Type cues: proposal → `rfc`; requirements → `spec`; settled choice → `decision`; steps → `plan`; teaching → `explainer`; always/never → `principles`; how-to → `guide`; bug → `issue`; findings → `research`. Scaffold sections: Summary · Motivation · Design · Open questions (Decisions use Context/Options/Decision/Consequences; Research uses Findings/Confidence).

## Artifact

A new `Draft` LLP with a complete metadata header (`Type`, `Status`, `Systems`, `Author`, `Date`; `Related:` where relevant) — plus an offer to draft the body from the current conversation. Confirm the assigned number and path back to the user.

## Hand-offs

- No corpus to add the document to → `llp-adopt`.
- The document is foundational or contentious → `llp-review`, scaled to stakes (LLP 0005).
