---
name: harness-first
description: "Use when a change is meant to move a number: faster, smaller, smoother, cheaper or less flaky (startup, jank, frame drops, bundle size, memory, CI time, API cost, eval scores, any hill climb), or when Peter asks how you know it is faster. Measure a baseline first, then report the change against it. Not for a bug with a repro."
---

# Harness first

A number nobody measured before the change is a guess, and a guess in a PR body is a claim nobody can check. Peter's rule: no change meant to improve a number lands without a committed baseline from a harness in the repo.

## 1. Name the number

Before reading code for fixes, write down: the metric and its unit (late frames per scenario, cold start ms, bundle bytes, p95 latency, flaky failures per 100 runs), which direction is better, the environment users run (physical device model, release build, production bundler, real data), and Peter's target if he gave one. This goes in the contract's acceptance checks as "baseline X on base SHA, after Y on head SHA, same harness, same environment".

## 2. Find the harness before writing one

Search, and record what you found and why it fits or not:

- `scripts/`, `tools/`, `bench*`, `perf*`, `profil*`, `verify*`, package and task-runner scripts, CI workflows.
- The repo's agents file and docs, and the skills installed for the stack (profilers, e2e recorders).
- Earlier PRs: `gh pr list --search "perf OR benchmark OR baseline" --state all`. A PR with a before-and-after table names its harness.

Use an existing harness when it measures the named number in the environment users run. Extend it before replacing it.

## 3. No harness: building it is the first PR

The harness PR holds no optimization, so it is reviewable on its own and a later PR cannot quietly change how it measures. It contains:

- one command that runs it, documented in its README and the repo's agents file;
- the shipped runtime: a release build on a real device for app performance, the production bundle for size, the deployed stack or a copy of it for latency. A cheaper proxy only after you show it moves with the real number;
- warm-up, at least five runs, median and spread, machine-readable output, and a way to run two builds or refs back to back (A/B);
- the baseline: a file next to the harness, `baselines/<YYYY-MM-DD>-<metric>.md`, with the base SHA, environment, run count, median and spread per scenario.

If the spread is larger than the effect you expect, fix the noise (more runs, pinned device state, fixed data) before any optimization.

When a harness exists but no committed baseline does, or it was taken on older code or another environment, run it on the base and commit the baseline the same way.

The baseline, with the harness if it is new, is its own PR, opened before any optimization work and never a commit inside the optimization PR. It is the one exception to starting a build as one draft PR: it holds no behavior change, so it can merge while the optimization is still being built, and the optimization PR stacks on it.

## 4. Every change: the same harness, the same environment, the delta

Each optimization PR body carries a table: scenario, baseline (base SHA), after (head SHA), delta, runs, spread. A delta inside the spread is "no change", not a win. Run both orders when the device can drift (A then B, B then A). Never change the harness and the code in one PR: a harness change needs a new baseline first.

On a hill climb, keep a log of each attempt with its delta and whether you kept or reverted it. Keep a change only when its delta beats the spread. Revert the rest.

## 5. Blast radius: one real run per flow

The number shows the target got better, not that nothing else broke. Before changing code, write the flow list into the contract: every user flow that passes through the files you will touch (find them from the callers and screens that import them), each with its steps and the expected result. After the change, run each one end to end on the same build you measured, one row per flow in the proof table. A visual spot check of the target screen is not a flow run. A flow you could not run is its own row marked unverified.

For a change to an API or shared code, add a caller check to the number: list the callers, state what each depends on, and make one real call per caller before and after.

## Never

- Quote a number from another environment (a dev build, a simulator, a different device) as the result.
- Tune the harness, scenarios or run count after seeing the new numbers.
- Drop a scenario or a run because it went the wrong way. Report regressions in the same table.
