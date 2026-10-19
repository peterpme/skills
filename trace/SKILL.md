---
name: trace
description: Research how a specific feature of the current codebase works, using repository code as the sole source of truth. Invoke explicitly.
disable-model-invocation: true
---

# Trace

Research the repository internally. Return the answer the user is looking for.

## What to return

- Answer every part of the question directly, in the user's terms. For a practical question, give the actual steps, settings, names, and commands. For an implementation question, explain how it works.
- Default to a short answer and a few useful bullets, under 200 words. Expand only when the question needs it. Keep limitations that change what the user can do.
- Keep Git revisions, research steps, evidence trails, orchestration details, and verification receipts internal. Do not include a source list, file names, code citations, or a "source of truth" explanation unless the user asks for sources or code locations.
- Do not add "I didn't test this," "unverified," or research-summary sections. If necessary information is missing, state the specific unknown briefly where it affects the answer.
- Use `/tldr`'s brevity and faithfulness as an optional final shortening pass when available; otherwise shorten directly. Do not send the long draft first, force a status-report template onto a question, or remove a requested answer or necessary caveat.
- Before sending, remove sentences about your process or proof. Return only the useful answer.

## Where the answer comes from

Use inspected code in the current repository as the sole evidence for every substantive claim. Reason from that evidence; never fill gaps with model memory, framework conventions, web searches, external documentation, or other repositories.

Keep the source locations internally so you can explain them if asked. Docs, comments, examples, and tests are leads or corroboration; executable code wins when they disagree. A dependency name or pinned version does not establish unavailable internals. Trace the repo's inputs to external systems and its handling of their outputs; leave missing internals or runtime configuration unknown.

## Refresh the existing checkout

- Use the current checkout; do not create a worktree or branch for research. Respect an explicitly requested revision or offline session.
- Inspect the root, branch, working-tree status, remotes, and upstream. On a clean branch with an upstream, run `git pull --ff-only` before searching, once per research session.
- Preserve local edits. If dirty, fetch the configured remote without merging and research the current files, accounting for relevant local changes. If detached, missing an upstream, diverged, or unable to update, continue at the available revision. Mention the limitation only if it changes the answer.
- Never stash, reset, rebase, switch branches, or guess another remote branch to force an update. Track the revision internally; fetching alone does not update working files.

## Trace enough code to answer correctly

1. Locate the behavior the question describes: an action, route, command, setting, data field, or output. Use `rg --files` and targeted `rg` searches; avoid dumping the whole repo.
2. Follow the real entry point through callers, imports, registration, dispatch, and configuration to the result. A matching name or unused function is not proof that it runs.
3. Check the relevant defaults, branches, transformations, side effects, persistence, and errors. Before stating a restriction, follow its condition back to the caller and confirm it applies. Resolve conflicting paths instead of presenting both as general rules.
4. Recover from a missing path by finding the implementation elsewhere; do not fall back to docs as proof. A failed search does not establish absence.
5. Stop when each requested answer has a complete supporting path. Reuse discovered paths across follow-ups, but reread decisive code before relying on an earlier answer.

Research is read-only apart from the Git refresh. Do not install dependencies, change source, create caches or artifact directories, commit, or open a PR for a research question. Run a local check only when needed and authorized, without production writes or external side effects.

## Keep research cheap

Search directly for narrow questions. When delegation helps, prefer one inexpensive Haiku/Luna-class researcher; parallelize only independent paths. Discover actual available model IDs and cost information rather than inventing IDs or claiming an unverified cheapest model. If delegation is unavailable, continue locally.

Give researchers the question, repository path and revision, bounded scope, repo-only evidence rule, and a request for internal file/line evidence, call paths, and gaps. Share the checkout read-only; only the parent refreshes Git, before delegation. Inspect decisive code yourself before accepting their conclusions. Escalate only a specific gap a cheaper pass cannot resolve. Keep this orchestration out of the answer.
