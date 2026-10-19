---
name: trace
description: Research how a specific feature of the current codebase works, using repository code as the sole source of truth. Invoke explicitly.
disable-model-invocation: true
---

# Trace

Answer the user's question by tracing the current repository's implementation. Every substantive claim must come from inspected repository evidence. Use reasoning to connect that evidence, but never fill gaps with model memory, framework conventions, web searches, external documentation, or knowledge of other repositories. If the repo cannot establish something, say so.

## Establish the version

- Work in the existing checkout; do not create a worktree or branch for research. Respect an explicitly requested revision or offline session instead of updating it.
- Inspect the repository root, branch, working-tree status, remotes, and configured upstream. For a clean branch with an upstream, run `git pull --ff-only` before searching. Do this once per research session, not for every follow-up.
- Preserve local changes. If dirty, fetch the configured remote without merging; research the current files and identify the local changes relevant to the answer. If detached, missing an upstream, diverged, or unable to fetch/pull, report the limitation and continue at the available revision. Never stash, reset, rebase, switch branches, or guess a different remote branch to force an update.
- Record the resulting commit and whether the checkout is dirty. Distinguish the checked-out revision from fetched remote code; never describe a fetch alone as updating the working files.

## Find the smallest complete path

1. Turn the question into concrete behavior to locate: a user action, command, route, symbol, setting, data field, or output. Ask only if ambiguity prevents a useful trace.
2. Use `rg --files` and targeted `rg` searches to find likely entry points. Follow actual callers, imports, registrations, and dispatch wiring into the implementation. Avoid reading the whole repo or dumping large files.
3. Trace the relevant path from input to observable result: conditions and defaults, transformations, side effects, persistence, return values, and failure paths as needed for the question. Follow the selected implementation through wrappers and configuration; a matching name or unused function is not proof that it runs.
4. Read implementation before explanatory docs. Use comments, docs, examples, and tests as leads or corroboration; when they disagree, report what executable code does. Tests establish the covered cases, not every runtime condition.
5. Check the branches or alternative callers that could change the answer. Stop when the question is answered and the important links are evidenced; expand only to resolve a concrete gap. A failed text search alone does not prove a feature is absent. Describe the searched scope when reporting that nothing was found.

Treat unavailable dependency internals, external services, deployment settings, generated files, and runtime data as boundaries. Trace what this repo passes to them and how it uses their results. A dependency name or pinned version does not establish its behavior. Inspect internals only if their source is actually present in this repo. Do not infer live production behavior or design intent from source alone.

Research is read-only apart from the Git refresh. Do not install dependencies, change source, create cache/artifact directories, commit, or open a PR for a research question. Execute a local check only when needed, within existing authorization, and without production writes or external side effects.

## Keep the research cheap

For a narrow lookup, search directly. When delegation would reduce work, prefer a single inexpensive Haiku/Luna-class researcher, adding parallel researchers only for independent paths. Discover available model IDs from the current tool catalog; use cost information when available rather than claiming a particular model is cheapest. Do not invent model IDs or silently substitute a premium model. If selection or delegation is unavailable, continue locally and state that limitation briefly.

Give each researcher the question, repository path and revision, a bounded search scope, the repo-only evidence rule, and a request for file/line citations, call paths, and unresolved gaps. All researchers share the checkout read-only; only the parent refreshes Git, before delegating. Reuse discovered paths across follow-ups, but reread the relevant code before relying on an earlier answer. Inspect the decisive code yourself before presenting delegated conclusions. Escalate only the specific unresolved reasoning problem when a cheaper pass cannot establish it.

## Return an evidence-backed answer

Lead with the answer in plain language. Include the shortest useful execution path and cite the exact files and line numbers supporting each substantive claim. Prefer clickable local source links; use commit-pinned GitHub links when sharing outside the checkout. Include the researched branch/commit and any update limitation in a compact note.

Distinguish directly observed code from deductions, citing the premises for deductions. State what the repo cannot establish and the missing source or runtime input. Never turn an assumption, stale doc, prior answer, or researcher summary into a fact. Keep answers proportional to the question; do not produce a repo tour unless asked.
