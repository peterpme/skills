---
name: skill-gardener
description: Every three days, cut cruft from Peter's global agent instructions and skills - duplicated rules, narration, stale dates, lines no check backs, rules that say the same thing - as one PR on the skills repo with a words-before-and-after table, merged when the replay eval holds and left a draft with the score otherwise. Use for the scheduled Skill gardener run, or when asked to trim, dedupe or shorten the skills. Not for adding rules, scoring findings or adding eval cases (skill-review).
compatibility: Runs on the machine that holds the private eval cases (~/.local/share/skill-evals/orchestrate). Needs the claude and codex CLIs, gh and node.
---

# Skill gardener

Goal: every line in `global/AGENTS.md` and the skills earns its place. The gardener cuts; the weekly skill review measures and adds (findings, rules, eval cases). One run: measure, cut, score, one PR, report.

- Cut only. Never add a rule, change a number, path, model, command or meaning, or reword a line into a new behavior. A line that is wrong rather than surplus becomes a `finding` issue in the home repo for skill-review.
- Budget: one eval comparison per run, about $30 (32 agent sessions plus judging). Run it in the background with a log and wait for it inside the turn. Never end the turn while it runs.
- The skills repo is public. Run the leak check from skill-scout section 6 on the diff and the PR body before pushing.

## 1. Measure

1. `git -C ~/skills fetch origin`. Make a worktree at `~/skills/.claude/worktrees/gardener-<date>` on branch `gardener/<date>` from `origin/main`.
2. If a `skill-review/*` PR is open on the skills repo, leave the files it changes alone this run.
3. Run `skill-gardener/scripts/words` in the worktree. On the first run (no `~/.local/state/skill-gardener/runs.md` yet) that table is the baseline: put it in the PR body and the report as "Baseline, words per file".

## 2. Cut

Read each of `global/AGENTS.md` and `*/SKILL.md` whole. Cut these, nothing else:

| Cruft | Looks like | Do |
|---|---|---|
| Duplicated rule | the same rule in two files, or twice in one | keep it in the skill that owns the step; delete the other |
| Narration | why a rule exists, what an earlier version did, who said it when, reassurance, "note that" | delete; reasons live in git history and the home ledger |
| Stale date | "since <date>", "as of", "today", "(Peter, <date>: …)", "still", "now", a dated status | delete the date, or the line when the date was its point |
| Lines no check backs | a tool, path, model, flag, task or pause that no longer exists (`command -v`, `ls`, `rg` the repo and `~/dotfiles/docs/tools/`) | delete the line, or the section when nothing else is left |
| Same-meaning rules | two rules that differ only in wording | merge into the one with the exact command or number |
| Enforced prose | a rule a script, hook or CI check already enforces | keep one pointer to the check |

Never cut: frontmatter, a sentence another skill tells agents to copy word for word, a decision with its revert word, an example a format rule needs, or a number. The eval scores planning only, so for a duplicated rule in a step it does not cover (proof, review, the ready gate, merging) the PR table names the line that still says it. At most about 15% of a file's words per run, so a drop in the score points at a few cuts. One commit per file, with the cut kinds in the message.

## 3. Score

From the worktree, in the background with a log: `REPS=2 node evals/orchestrate/run.mjs origin/main .`. Read `report.mjs` on the run. The score holds when the train mean drops by no more than 0.1 and no case drops by more than its spread between reps. If the eval cases are missing, the run is unscored.

## 4. One PR

Title `gardener <date>: -N words`. Body, nothing else:

- a table with columns file, words before, words after, what was cut and why (the cut kind from section 2), from `skill-gardener/scripts/words origin/main` plus your notes;
- the eval line: train `main` → branch, cases and reps, or "unscored: eval cases missing";
- on the first run, the baseline table;
- `Sizes:` each `SKILL.md` over 500 lines, if any.

Then:

- **Holds:** follow finish-task's ready gate (`pr-status`, `pr-threads` empty, every bot thread answered), merge, delete the branch, `npm run release` from `~/skills`.
- **Drops or unscored:** leave the PR a draft with the score in the body. Next run, retry its cuts one file at a time on a fresh branch and close the draft.
- **Nothing to cut:** open no PR.

Case ids and judge notes name private work: they go only in the report, never in the PR.

## 5. Report and log

```
**Skill gardener, <date>:** <-N words in M files, PR #n merged | PR #n draft, score dropped | nothing to cut>

| File | Before | After | Cut |
|---|---:|---:|---|
```

Eval: train `main` <score> → branch <score> (<cases> cases, 2 reps), or unscored. Then append one line to `~/.local/state/skill-gardener/runs.md`: date, words before and after, PR, score, merged or draft.

## Set up

Only on the machine with the eval cases, and only after this skill is merged, since scheduled runs read `~/skills`, which tracks `main`. Call `schedule_task` with `projectId` the "No project" (scratch) project, `bindToCurrentThread: false`, `title: "Skill gardener"`, `schedule: {type: "interval", everyMs: 259200000}`, and this prompt:

> [t3-sentinel-run] Run the skill-gardener skill: one run on this machine. Read `~/skills/skill-gardener/SKILL.md` and follow it. If the skill file is missing, reply in one line starting with "Needs your call:" and stop.

If `~/.t3/sentinel/config.json` exists, add the returned `scheduledTaskId` to its `cleanup_task_ids`. Report the next run time.
