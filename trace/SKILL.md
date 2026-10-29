---
name: trace
description: Answer questions about a specific feature using the current repository's docs and code, checking implementation when behavior matters. Invoke explicitly.
disable-model-invocation: true
---

# Trace

Research the repository internally. Return the answer the user is looking for.

## What to return

- Answer every part of the question directly, in the user's terms. For a practical question, give the actual steps, settings, names, and commands. For an implementation question, explain how it works.
- Lead with a short answer, then choose prose, steps, or a compact question-and-answer table to fit the question. A table works well for several related questions. Keep enough detail to make the answer usable, including limitations that change what the user can do; do not force a word limit.
- Keep Git revisions, research steps, evidence trails, orchestration details, and verification receipts internal. Link a relevant user guide when it helps the user follow the steps or learn more. Do not append a source catalog, code citations, or a "source of truth" explanation unless the user asks for sources or code locations.
- Do not add "I didn't test this," "unverified," or research-summary sections. If necessary information is missing, state the specific unknown briefly where it affects the answer.
- Use `/tldr`'s brevity and faithfulness as an optional final shortening pass when available; otherwise shorten directly. Do not send the long draft first, force a status-report template onto a question, or remove a requested answer or necessary caveat.
- Before sending, remove sentences about your process or proof. Return only the useful answer.

## Where the answer comes from

Use the current repository's docs and code as evidence. For practical questions, start with relevant user guides, setup instructions, and examples: they often explain the supported workflow more clearly than implementation details. For implementation questions, start with code. Reason from inspected repository content; never fill gaps with model memory, framework conventions, web searches, external documentation, or other repositories.

Use docs for user-facing terminology, commands, examples, and task steps. Check the implementation for consequential behavior claims such as restrictions, defaults, persistence, and sharing. Do not trace every documented setup step through code when that would not improve the answer. If docs and code disagree about actual behavior, follow the applicable implementation path rather than repeating the stale claim. Keep source locations internally so you can explain them if asked.

A dependency name or pinned version does not establish unavailable internals. Repository docs can provide supported setup instructions for external tools without their internals being present. Trace the repo's inputs to external systems and its handling of their outputs when relevant; leave missing internals or runtime configuration unknown.

## Pull the latest code first

Before any search, bring the checkout up to date with the remote, once per research session. Answers from stale code are wrong answers. Skip this only for an explicitly requested revision or offline session.

- Research in the current checkout, normally the main branch. Do not create a worktree or branch. Inspect the branch, working-tree status, and upstream.
- Clean branch with an upstream, the usual case (`main` tracking `origin/main`): run `git pull --ff-only`.
- Dirty or diverged: run `git fetch` and do not move HEAD. Research the current files, and check `git diff HEAD...@{u} -- <relevant paths>` so newer upstream changes to the feature are reflected in the answer.
- Detached or without an upstream: fetch, and compare the relevant paths against the remote default branch (usually `origin/main`) the same way.
- If fetching fails, continue at the available revision. Mention the limitation only if it changes the answer.
- Never stash, reset, rebase, or switch branches to force an update. Fetching alone does not update working files. Track the revision internally.

## Find the answer efficiently

1. Locate the question's feature using `rg --files` and targeted `rg` searches. For a how-to question, read its user guide first and use the guide's terms to locate any behavior that needs checking. Avoid dumping the whole repo.
2. Where code is needed, follow the real entry point through callers, imports, registration, dispatch, and configuration to the result. A matching name or unused function is not proof that it runs.
3. Check the relevant defaults, branches, transformations, side effects, persistence, and errors. Before stating a restriction, follow its condition back to the caller and confirm it applies. Resolve conflicting paths instead of presenting both as general rules.
4. Recover from a missing code path by searching for the implementation elsewhere. Docs can establish documented instructions, but a failed code search does not establish absence or resolve a behavior conflict.
5. Stop when the requested answers are supported by the relevant docs and, where needed, the actual implementation path. Reuse discovered paths across follow-ups, but reread decisive sources before relying on an earlier answer.

Research is read-only apart from the Git refresh. Do not install dependencies, change source, create caches or artifact directories, commit, or open a PR for a research question. Run a local check only when needed and authorized, without production writes or external side effects.

## Keep research cheap

Search directly for narrow questions. When delegation helps, prefer one inexpensive Haiku/Luna-class researcher; parallelize only independent paths. Discover actual available model IDs and cost information rather than inventing IDs or claiming an unverified cheapest model. If delegation is unavailable, continue locally.

Give researchers the question, repository path and revision, bounded scope, repo-only evidence rule, and a request for internal file/line evidence, call paths, and gaps. Share the checkout read-only; only the parent refreshes Git, before delegation. Inspect decisive code yourself before accepting their conclusions. Escalate only a specific gap a cheaper pass cannot resolve. Keep this orchestration out of the answer.
