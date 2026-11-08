---
name: skill-review
description: Weekly check that Peter's skills still earn their lines. Turns the scout's open finding issues into one scored change and merges it when the replays of real past tasks say it helps, and adds new replay cases from the week's friction. Use for the scheduled weekly Skill review, or when asked to evaluate or compare versions of the skills. Not for finding new patterns in threads (skill-scout) or for cutting text (skill-gardener).
compatibility: Runs on the machine that holds the private eval cases (~/.local/share/skill-evals/orchestrate). Needs the claude and codex CLIs, gh and node.
---

# Skill review

Goal: every scout change reaches Peter with evidence. One run: add cases, score the filed findings, report. This review measures and adds; cutting text is skill-gardener's job, every three days.

- Never commit cases, transcripts or run output to the skills repo. The repo is public; cases come from private work. They live in `~/.local/share/skill-evals/orchestrate/`.
- Budget: at most two eval comparisons per run, about $30 each (32 agent sessions plus judging). Run each in the background with a log (`runq` or a background command), and wait for it to finish before going on. Never end the turn while one runs.

The eval is `evals/orchestrate/` in `~/skills`; read its README first. It replays real past tasks up to the point of the first edit and grades the plan against what Peter later had to say. It doesn't measure execution after planning.

## 1. Add cases (up to 3)

Look at `~/.local/state/skill-scout/ledger.md` for events since the last review; its date is the last entry in `climb.md` in the eval folder. Pick threads where Peter's first message asked for a build and he stepped in at least twice afterwards. Write each one following the README's "Case format" and its rules for picking interventions. Make every third new case `"split": "holdout"`.

## 2. Score the filed findings

List them: `gh issue list -R peterpme/home --label finding --state open --json number,title,body --limit 100`. Skip findings whose body has no proposed text yet. If any remain:

1. Run `git -C ~/skills fetch origin`. Make a worktree at `~/skills/.claude/worktrees/skill-review-<date>` on branch `skill-review/<date>` from `origin/main`, and apply each finding's proposed text as its own commit, generic wording only.
2. Run `REPS=2 node evals/orchestrate/run.mjs origin/main .` from that worktree.
3. If the train mean rises by more than 0.1, run `SPLIT=holdout` once.
4. Verdict per batch: helps, within noise, or hurts (train mean down by more than 0.1, or any case down by more than its spread between reps).
5. **Helps or within noise:** run the leak check from skill-scout section 6, open the PR with aggregate numbers only, and merge it under the personal-repo rule in the global instructions. Then `npm run release` from `~/skills`, close each finding issue with the numbers, and mark the ledger `merged`.
6. **Hurts:** drop findings one at a time until the batch passes, merge what passes, and comment the numbers on each dropped finding, which stays open for the scout to gather more evidence or for Peter to overrule.

Case ids and judge notes name private work, so they go only in the T3 report and the finding issues, never in the skills PR.

## 3. Cuts and sizes

Not here. Skill-gardener cuts duplicated, stale and narrated lines and flags oversized skills every three days. A line that is wrong rather than surplus is a `finding` issue, scored in section 2.

## 4. Report

```
**Skill review, <date>:** <N findings merged as PR #n / M dropped; nothing to do>

| Check | Result |
|---|---|
| Findings PR #n | train <main> → <PR> (<cases>), holdout <…>, verdict, issues closed |
| New cases | N (ids) |
| Spend | $N |
```

Then append the run to `climb.md`: the date, what was compared, the scores, and what was kept.

## Set up

Set this up only on the machine with the eval cases, and only after this skill is merged: scheduled runs read `~/skills`, which tracks `main`. Call `schedule_task` with:

- `projectId`: the "No project" (scratch) project;
- `bindToCurrentThread: false`;
- `title: "Skill review"`;
- `schedule: {type: "fixed_time", timeOfDay: "08:00", weekdays: [1]}`;
- this prompt:

  > Run the skill-review skill: the weekly review on this machine. If `~/skills/skill-review/SKILL.md` or the eval cases are missing, reply in one line starting with "Needs your call:" saying which, and stop.

`docs/feedback.md` in the home repo holds Peter's own words about how agents should work, newest first. Read it before anything else; each entry outranks a pattern inferred from threads.
