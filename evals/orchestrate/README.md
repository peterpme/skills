# Orchestrate eval

Measures whether a version of the skills gets an agent to plan Peter's real build tasks well enough that he would not have had to step in. Each case replays a past task, frozen at the commit it started from, and grades the agent's plan against what Peter actually had to say later in that thread.

Cases and run output come from private work repos. They live outside this public repo, in `~/.local/share/skill-evals/orchestrate/` (override with `SKILL_EVAL_HOME`). Never commit them here.

## Run

```bash
node evals/orchestrate/run.mjs main .             # compare main with the working copy
CASES=wallet-pr-gate,exchange-ledger REPS=2 node evals/orchestrate/run.mjs main .
SPLIT=holdout node evals/orchestrate/run.mjs main .
node evals/orchestrate/report.mjs <run dir>       # per-case scores and every missed intervention
```

Each variant is a git ref of this repo, or `.` for the working copy. A variant is its global `AGENTS.md` plus every skill at that ref, loaded as a plugin. User settings, hooks and MCP servers are left out, so `main` and `.` differ only in the skills and instructions.

Per case and variant:

1. A shallow clone of the case's repo at `base`, with no later history, so the agent can't read the merged answer. One clone per case, shared by all runs.
2. The agent (`MODEL`, default `claude-opus-5-5`) gets Peter's original message plus a fixed note: start the task as you normally would, and stop at the point where you would first change a file, posting the message you would send Peter then. So whether the skill triggers is part of what gets measured. Its tools are read-only: `Read`, `Grep`, `Glob`, and read-only git and shell commands. It has no network, `gh` or T3 tools.
3. A judge (`JUDGE_MODEL`, default Sol, `gpt-6.1-sol` via `codex exec`) gets the plan and the case's hidden interventions, without knowing the variant. For each intervention it rules `prevented`, `asked`, `missed` or `contradicted`, and it labels each question in the plan `needed` or `routine`.

Score per run, between -0.5 and 1:

| Verdict | Intervention knowable from the request and repo | Only Peter knew |
|---|---|---|
| prevented: the plan does the right thing unprompted | 1 | 1 |
| asked: the plan asks about it and proceeds on a default | 0.25 | 0.75 |
| missed | 0 | 0 |
| contradicted: the plan does what Peter corrected | -0.5 | 0 (same cost to Peter as missing it) |

The score is the mean credit over the case's interventions, minus 0.05 for each routine question (at most 0.25), and minus 0.1 if the plan waits for Peter before starting. The report gives the mean per variant, the per-case scores, and the verdicts with the judge's notes.

Each run costs one agent session and one judge call: on the first cases, 1 to 4 minutes and $0.40 to $1.30 of Opus usage per session. Scores of the same variant vary by up to 0.45 between reps on one case, so compare means over at least 8 cases with `REPS=2`, and treat differences under about 0.1 as noise. `CONCURRENCY` (default 3) limits parallel agent sessions.

## Case format

`cases/<id>/case.json`:

```json
{
  "id": "wallet-example",
  "split": "train",
  "repo": "~/Projects/<org>/<repo>",
  "base": "<sha on the default branch just before Peter's request>",
  "prompt": "Peter's request, verbatim, with any context from the same message",
  "source": { "thread": "<T3 thread id>", "from": "<ISO time of the request>", "prs": ["<url>"] },
  "interventions": [
    {
      "id": "i1",
      "quote": "what Peter said, under 40 words",
      "kind": "correction | repeat | ignored-decision | false-done | pr-not-ready | scope | routine-question | stall | manual-step",
      "knowable": true,
      "expect": "what a plan written before any code should contain to make this message unnecessary"
    }
  ],
  "reference": "what finally shipped: PRs, approach and size, in a few lines"
}
```

Rules for picking interventions:

- Keep only messages where Peter corrected, repeated, nudged or overrode the agent on **this task**. Leave out new requirements he thought of later, changes of mind, and questions he asked to learn something.
- `knowable` is true when the request, the repo at `base`, or Peter's standing instructions (global `AGENTS.md`, repo docs) already implied the answer. False when only Peter could have known it. Then the right plan asks, with a default.
- `expect` describes plan content, not code: "an acceptance check that compares imported photo counts against the source", or "splits the change into PRs under about 600 lines with a codemod for the renames".
- Execution-only failures that a plan can't prevent, such as a hung process or a stall mid-build, can be included with `"kind": "stall"`. The judge credits them when the plan sets up the safeguard, like backgrounding with a timeout or reporting progress.

A case needs at least 2 interventions. Mark about a third of the cases `"split": "holdout"` and never tune the skill on them.

## Hill climbing

1. Run `main` against `.` on the train split with `REPS=2`.
2. Read `report.mjs`. Group the missed and contradicted interventions by what the plan lacked.
3. Change the skill to fix a group in general terms. Never name a case, repo, library or decision from the cases in a skill: the fix is a behavior (where to look, what to record, what to check), not the answer. Check the diff against the private-terms list before committing.
4. Rerun the train split. Keep the change if the mean rises by more than the spread between reps. Then run the holdout split once. If holdout drops, the change overfit, so revert it.
5. Record each step in `~/.local/share/skill-evals/orchestrate/climb.md`: the change, the train and holdout scores, and keep or revert.

What this does not measure: execution after planning (stalls, CI fixing, review loops, the ready gate in practice), or anything that needs network or T3 tools. Those need full end-to-end runs.
