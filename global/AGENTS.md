# Global agent instructions

Source: `global/AGENTS.md` in `~/skills`. `npm run sync` links it into every harness. Cursor has a pasted copy of "Reporting results".

## Ten principles

Every task follows these. Each names what you do and what you never do.

| Principle | Do | Never |
|---|---|---|
| Define done first | Write the executable check and its expected values before the work | Start code without a criterion, or move the criterion to fit the result |
| Contract before code | Goal in my words, my decisions, out of scope, acceptance checks. One page I can veto in two minutes | Build the wrong thing well |
| Verify before you change | When money, keys, releases or a public API are involved, the first PR is the check that would catch the change, passing on today's code | Change what you cannot yet observe |
| Measure, change, measure | Baseline, change, same measurement again, both numbers in the PR | Call anything faster or better without a number |
| Use what exists | The repo's tooling, the framework's conventions, established libraries, prior art. Custom code carries a written reason | Land a one-off script in a PR, or write a library when one exists |
| Smallest reversible step | One ticket, one stack of PRs under 400 lines of code each, every one mergeable and revertible alone | A giant PR, or sibling PRs that conflict |
| Replace, do not accumulate | Close the superseded PR in the same turn, delete the absorbed script, cut a rule when you add one | Leave the old attempt open |
| State lives in the ledger | Write to the ticket at fixed events: start, contract, PR, decision, finding, blocked, done | Keep the status in the conversation |
| Stop loudly | When a check cannot be written or a decision is mine, say so in one message with your pick, then wait | Proceed under a guess you did not state |
| Report like a VP | The decision I need, the evidence as a table, what is blocked. Backstory on request | Narrate the work |

## Tiers

Classify the task at the start and write the tier in the ticket. I can override in one word.

| Tier | Examples | Gates |
|---|---|---|
| 0 | Typo, config, one-file fix, question | finish-task only |
| 1 | Feature, refactor, dependency change, hill climb on data | Contract, ledger, PR stack, proof table, harness before the climb |
| 2 | Money, keys, releases, public API, perf claims | Tier 1 plus the domain model, verify-first, an independent oracle, review by the other model family |

## Where state lives

- Under my work folder (the home repo README names it): Linear. Elsewhere: issues in the private `home` repo at `~/Projects/home`. Create, update and close them yourself; I never approve a ledger entry.
- Knowledge about one codebase goes in that repo's agents file. Knowledge about a domain goes in its skill. A finding that lands in none of the three is a defect.
- Past sessions are logged in `~/Documents/Claude/session-logs/` (categories in `categories.json`). When a topic clearly matches a category, read the 1-3 most recent relevant logs first.

## Understanding the request

- Work out what I'm asking for and what finished looks like to me before you act. Check the installed version, its docs or the live UI before saying something can't be done.
- Ask first only when two reasonable readings lead to different work, or when the wrong one would delete, publish, spend money or be hard to undo. One message: each question, its options with the main gain and cost, and your pick. Never ask what the code, the docs or my earlier messages already answer.
- Otherwise state your reading in one line at the top and do the work.

## Reporting results

A VP briefing an executive: the exec needs the decision and the evidence, not the back story.

- Every final reply uses the shape in `~/.agents/skills/tldr/SKILL.md`: a one-line TLDR, numbered decisions with your pick, Done, Next, each line 15 words or fewer. The long version only when I ask for it.

- Lead with the answer. A yes/no question gets yes or no first. Then what is still broken and what you need from me.
- Prove it with the actual data: records, numbers, links, a before and after. A small table beats a paragraph. In a coverage list, account for the whole, including what you did not test as its own row.
- Keep it short. No process narration, hedging, recaps of the request, or labels you invented during the work. Plain words, complete sentences.
- Say plainly what is unverified or waiting on me, and give the exact step I need to take.

## Finishing work

- For any change to project files, follow `~/.agents/skills/finish-task/SKILL.md`: prove it through the real flow, run the repo's checks, commit only the task's changes, push a task branch and open a draft PR, or update the existing one. Skip it for questions, reviews and plans.
- Proof means running the real UI, API or CLI with representative data and showing expected next to actual. A pass count or a finished job is not proof. If you can't run the flow, say `implemented, unverified` and name what's missing.
- Tier 1 and 2 work, or any work that coordinates other agents, also follows `~/.agents/skills/orchestrate/SKILL.md` from the start: the contract comes before any code.
- Never say done, working or verified about something you didn't check.
- Merging by repo class. Personal repos (owner `peterpme`, including home, dotfiles and skills): when checks are green or absent and the PR carries its proof, mark it ready, merge it yourself, delete the branch, note it in the ledger. Close your own personal PR when it is superseded or idle for 14 days. Work repos (my work folder): the team or I merge, never you; close your own PR with one status comment after 14 days without a human review, unless its ticket names the reviewer it waits on.
- Exempt from merging and from the 14-day close: Peter's own writing (the blog repo) and any PR whose body says do not merge. Leave them open and never list them as needing him.
- Never deploy unless the task is the deploy.
- Run or dry-run a command yourself before handing it to me, and say which device each step needs. Commands I paste run in my interactive shell, where `rm`, `cp` and `mv` prompt and `^ # ~ ( |` must be quoted.

## Files and shell

- Put git worktrees at `<repo root>/.claude/worktrees/<name>` (make sure it's ignored), and logs, scripts and proof output in `.verification/<task>/` in the repo. Never `/tmp`. Nothing from `.verification/` lands in a PR. Remove a worktree once its branch is merged or abandoned.
- The laptop and Mac mini run zsh on macOS with BSD `sed`, `date` and `stat` (`sed -i ''`; GNU versions are `gdate`, `gstat`, `gtimeout`). Write multi-line scripts for `bash`, which is Homebrew bash 5. The home agents box is Linux with bash and GNU tools.
- Claude Code asks for my approval, even in full-access mode, on `rsync` (copy with `cp -R`), `cd` before `git` (use `git -C`), several `cd`s, `~` in an assignment, backslash-escaped spaces (quote the path) and `{` next to a quote. For multi-step shell work, write a script in `.verification/<task>/` and run `bash <script>`.
- `~/.rgrc` cuts `rg` lines at 100 columns and hides `.env` and lockfiles; pass `-M 0` for full lines. Use `jq` for JSON. For Python packages, `uv run -q --with <pkg> python -I script.py`.
- Keep output small: read line ranges, `git diff --stat` first, `gh … --json … --jq`, and `| tail -n 40` on logs.
- Helpers, each with `--help`:
  - `pr-status [N]`, `pr-wait [N]` (instead of sleep loops), `pr-threads [N]`, `repo-state`.
  - `disk-clean`: dry run of the disk space dead agent worktrees and old caches hold; `--apply` frees it, backing up uncommitted changes first.
  - `runq <cmd>`: run a noisy build or test, keep the log, print the exit code and last 20 lines.
  - `bgjob start NAME -- <cmd>`: run a job that must outlive your turn; `bgjob wait NAME` returns its exit code. Promise a later report only when something will wake you for it.

## Home infrastructure

My home setup and my ledger live in the private repo `peterpme/home`, at `~/Projects/home` on the laptop. Before you inspect or change any of it, run `git -C ~/Projects/home pull --ff-only` and read the README and the matching doc. Update that doc when you change the setup. Never write secrets there.
