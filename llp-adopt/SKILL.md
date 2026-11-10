---
name: llp-adopt
description: Bring LLP to a repository and keep its installed skills current — the single entry point for "set up LLP here" and "update the LLP skills". Scaffold mode (fresh structure), retrofit mode (survey the codebase, draft a provenance-tagged root LLP, propose an adoption plan), install step (copy skills from a tagged release with a receipt), and update mode (verified, diff-approved skill updates).
source: ccheever/llp@v0.5.2
---

# llp-adopt

<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0001-adopting-llp.guide.md — the workflow this automates -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0010.000-skill-installation-and-updates.spec.md — install/update design, receipts, trust model -->
<!-- @ref https://github.com/ccheever/llp/blob/v0.5.2/llp/0000-linked-literate-programming.explainer.md#provenance-for-generated-rationale — tagging rules for generated docs -->

One entry point for "add LLP to this project" and "update the LLP skills". Invoke as `/llp-adopt` (auto-detect scaffold/retrofit), `--mode scaffold` / `--mode retrofit`, or `/llp-adopt update`.

## Trigger

"Set up / bring LLP to this repo," for any repository state; "update the LLP skills," in any repo with installed skills.

## Invariants — adoption

- MUST extend an existing `llp/` tree if one exists — never start a second setup layer.
- MUST write only new files and clearly-marked managed blocks; existing user prose is never overwritten without showing a diff and asking. Reruns MUST be idempotent (no duplicate files or blocks).
- MUST keep every generated document `Draft` and provenance-tagged: claims are `[observed]` (say where), `[confirmed]` (named human + date), or `[inferred]` — and `[inferred]` claims never survive into a document proposed for promotion.
- MUST propose `@ref` annotations and apply them only after approval — no mass annotation, and none on volatile early code.
- MUST NOT create a batch of speculative LLPs in either mode; establish orientation and the loop, then hand off.
- When a tool expects `CLAUDE.md`, symlink it to `AGENTS.md` when safe rather than maintaining divergent copies.

## Invariants — install and update (LLP 0010.000)

- MUST install only from a tagged release (the tag's tree is the release), as copies never symlinks, and write a receipt beside the installation: origin, tag, resolved commit, profile flags (core; `review-plus`; `delivery`, which also records the repo's delivery policy in repo-local config), and a per-file content hash. The receipt — not `source:` frontmatter — is the trust root for updates.
- MUST confirm before writing user/global skill directories (they affect every repo for that user); project-local may proceed more freely.
- Update MUST three-way-check each file against the receipt hash. Any mismatch is a local fork: abort the coupled update, never clobber, and offer discard (restore managed copy) or detach (file leaves the managed set permanently; receipt records it; later updates ignore it and note upstream changes without applying).
- Update MUST present the full changeset for the installed profile *as defined at the target tag* as one diff, revalidate the approved state immediately before mutation, and be recoverable to either endpoint (the receipt write is the commit point). Runs are single-flight per installation.
- If upstream is unreachable, a tag moved or vanished, or content can't be verified against the resolved commit: report exactly that and write nothing. Cannot-verify never degrades to guess.

## Workflow

> **Recipe (advisory)** — *Adoption:* inspect first (existing `llp/`? agent files? how much code?): little to mine → **scaffold**; substantial history → **retrofit**. Both share the spine: `llp/` with its `current/` and `foundation/` overlay directories, root LLP 0000 (`Explainer`, `**Role:** Root`, `Draft` — linked into `current/`; it enters `foundation/` when the author makes it `Active`), the `AGENTS.md` managed block. Retrofit adds: survey, draft root LLP, propose 2–5 subsystem LLPs, layered annotation plan (LLP 0001). *Install:* offer after the managed blocks; default profile core, flags opt-in. *Update:* fetch the tag's tree (shallow clone or archive; git required), diff, approve, apply as a staged set with prior bytes retained until the receipt lands; rollback is `git revert` where the installation is committed, the backups otherwise. *Releasing (this repo):* bump `source:` pins and pinned URLs → commit → tag → push tag — a skill-file change is not installable until tagged.

## Artifact

Scaffold: `llp/` with `current/` (holding the link to the new root) and an empty `foundation/`, an LLP 0000 skeleton, the managed blocks. Retrofit: those plus a survey summary, `Draft` provenance-tagged document(s), and a proposed adoption plan. Install/update: pinned skill copies, the receipt, and (with the `delivery` flag) the repo policy file.

## Hand-offs

- Corpus exists → daily work starts with `llp-orient`; author follow-on docs with `llp-create`.
- Ratify generated drafts with `llp-review` where stakes warrant; keep healthy with `llp-maintain` — whose audit notes stale pins and hands back to `/llp-adopt update`.
