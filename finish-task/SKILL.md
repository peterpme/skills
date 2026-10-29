---
name: finish-task
description: Complete project changes through real-flow verification, required checks, and a draft pull request. Use for implementation, fixes, refactors, and project configuration or documentation edits; skip questions, read-only reviews, and planning-only requests.
---

# Finish task

Carry the user's requested changes through to a reviewable result. Do not stop at a plan, an implementation without verification, or an offer to do the remaining authorized work. Follow explicit user limits and repository instructions.

## Complete and prove the change

- Before editing, define the observable result that would demonstrate the requested behavior. Derive expectations from the request, source data, or an independent reference. Reproduce a reported failure when practical.
- Inspect the relevant instructions, existing changes, and project workflows. Preserve unrelated work. Make reasonable routine decisions and continue until the requested outcome is complete; ask only for information or authorization that actually blocks it. Continue independent work while waiting.
- Exercise the affected flow through its real UI, API, CLI, or exported entry point with representative inputs. Compare expected and actual output, including persistence where relevant. Include boundaries or exclusions that would catch a plausible wrong implementation. Use the project's verification instructions; a pass count or successful response alone is not proof.
- Inspect the final diff for omissions, regressions, unrelated changes, and accidental secrets. Fix problems introduced by this work, then run required formatting, lint, typecheck, build, and repository checks. Repeat the affected behavioral proof if those checks cause edits.
- Scale verification to the change. Do not invent runtime tests for prose edits, run unrelated paid generation, or add tests that merely mirror the implementation. Keep useful proof artifacts reviewable and free of secrets.
- If a required flow cannot run, try reasonable recovery within scope. Do not keep retrying the same failure or fabricate success. Label the affected claim `implemented, unverified`, name the missing prerequisite, and finish everything else possible. Distinguish pre-existing failures from failures caused by this change.

## Deliver a draft pull request

When invoked by the user's global completion instructions, project-change requests include permission to commit the task's changes, push a task branch, and open a draft PR. An explicit instruction to stay local, avoid commits, avoid pushing, or avoid a PR takes precedence. This permission does not include merging, deployment, production writes, or sending separate notifications.

- For a Git repository with a supported remote, create a new draft PR after completing the changes and available verification. For work explicitly continuing an existing PR, update that PR instead; do not create a duplicate or change its draft status unasked. Check for an existing PR for the task branch before creating one, including after a failed or ambiguous creation response.
- Use a task branch, not the default branch. Respect the project's branch and commit conventions. Stage only this task's changes, review the staged diff, and commit them. Do not include unrelated user edits or rewrite shared history. If task and unrelated edits cannot be separated safely, leave those edits intact and report the blocker.
- Inspect the outgoing commits and base branch before pushing. Push only the task branch with its intended commits; do not force-push or publish unrelated commits. Use available host tooling (for example, `gh pr create --draft` on GitHub). Read the repository's PR template and use actual newlines, preferably through a body file when using a CLI.
- Describe the problem and resulting behavior. Include expected versus actual evidence, checks run and their outcomes, and any remaining unverified claims or known failures. Do not present a blocked or partial implementation as complete; a draft may still carry clearly labeled partial work for review.
- Register the PR with the current application's thread when linking tools are available. Confirm its URL, base/head branches, draft status for a new PR, and that the pushed changes are present. Report CI as pending if it has not finished; local checks do not establish CI success.
- If there is no repository, remote, supported host tooling, or authentication, keep the completed local work and report the precise prerequisite for publishing. Do not create a repository, change remotes, merge, or deploy to work around the blocker.

## Hand back the result

Lead with what works and the PR link, or the concrete blocker. Show the smallest useful expected-versus-actual comparison and check results. State what remains unverified and any exact action needed from the user. Avoid an offer to finish steps that were already authorized.
