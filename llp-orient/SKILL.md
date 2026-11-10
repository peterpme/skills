---
name: llp-orient
description: Before editing a subsystem, file, or starting a task, assemble the governing LLP context — read the root LLP, follow the @ref annotations on the code in scope, and find the LLPs covering the relevant systems. Produces a compact context pack of the constraints a change must respect. Read-only.
source: ccheever/llp@v0.5.2
---

# llp-orient

<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0008-distributed-agent-skills.rfc.md#the-skills--core-five-plus-flags — skill contract -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0000-linked-literate-programming.explainer.md#2-reference-syntax — the grammar this reads -->

Load the design rationale governing the area you're about to touch, before touching it. This is the consumption side of LLP — orienting first is what turns `@ref` from a possibility into a habit.

Invoke as `/llp-orient <path-or-task>` (file, directory, subsystem, or task description). With no argument, use the current change scope (`git diff --name-only`).

## Trigger

Start of a coding task that touches an area with documented design. The orient-first *rule* lives in the repo's always-loaded `AGENTS.md`; this skill is the detailed form that rule routes to for non-trivial work — don't rely on ambient description-match alone.

## Invariants

- MUST be read-only: never edit code or LLP documents.
- MUST scope to the task: pull the constraints that bind this change, not a corpus summary.
- MUST cite, not restate: reference policy as `LLP NNNN#anchor` rather than paraphrasing sections.
- MUST NOT invent constraints. If something isn't documented, say so.
- MUST NOT guess the rationale behind a broken `@ref` — report it and hand off to `llp-maintain`.

## Workflow

> **Recipe (advisory)** — read `llp/foundation/` first (the kernel; the root LLP is there once `Active` — on a fresh adoption it is still `Draft` and sits in `current/`), then skim `llp/current/` (the declared working set); both hold relative links — symlinks, or small files containing the relative path — so `ls` answers and either form resolves. Then the root LLP's systems vocabulary. `Grep '@ref'` over the files in scope and `Read` each target — these are the highest-signal context. `Grep` the `**Systems:**` headers across `llp/` for LLPs governing the subsystems touched; read the governing ones (Spec, Decision, Principles, relevant RFCs). Follow `Related:` and nearby `@ref` targets one hop out; stop there unless something is clearly load-bearing. Stale-pin nudge (skip offline): read the installed tag from the skills receipt (or a `source:` pin), compare `git ls-remote --tags <origin>` — if upstream is newer, say so in one line ("skills at v0.3.0, upstream v0.5.2 — run /llp-adopt update") and move on; never update from here.

## Artifact

A context pack with these sections, faster to read than the documents it points at:

- **Scope** — files / subsystems queried
- **Governing LLPs** — numbered list, one-line gloss each; mark which are in `foundation/` and which are in `current/` (in-flight — its guidance may still move)
- **Active constraints** — bullets, each citing `LLP NNNN#anchor`
- **Relevant rationale** — the *why*, same citation form
- **Open questions / risks** for this area
- **Likely doc updates** if the change lands
- **Hand-off** — one of `none | llp-adopt | llp-create | llp-review | llp-maintain`

## Hand-offs

- No corpus (`llp/` missing or stub) → `llp-adopt`.
- The task needs a decision no LLP covers → `llp-create` (or `llp-review` if proposal-shaped).
- An `@ref` target or anchor doesn't resolve → `llp-maintain`.
