---
name: research-first
description: Before building a tool, script, harness, checker, benchmark, library or architecture, write a one-page prior-art note in 30 minutes or less - who the specialist is, what they reach for, what they measure and with what, what the repo already has, and a recommendation - then build on the best existing option. Use when a request would have you write new tooling ("write a script that…", "build a harness for…", "add a check that…"), pick a framework, work in an unfamiliar domain, or start a performance investigation, including when extending an existing script with a new capability. Not for a bug with a reproduction or maintenance that adds no new capability.
---

# Research first

The failure this prevents: a week of custom code that a reviewer rejects with "why didn't you use Y". Thousands of lines of custom signing checks next to published test vectors; a cleanup script rewriting what an installed cleaner already does.

## The prior-art note

Write it before the plan, in `.verification/<task>/PRIOR-ART.md`, and put its recommendation in the ticket and in the contract's approach. One page. Stop at 30 minutes and recommend with what you have.

1. **Who is the expert?** Name the specialist who does this for a living: a crypto security researcher, a React Native performance engineer, a Chrome extension performance engineer, a macOS app developer, a release engineer.
2. **What do they reach for?** Named tools and libraries, each with the one line that says why it is the standard. Installed first, then well-known open source, then paid.
3. **What do they measure, and with what?** The metric and the instrument they would trust. Frames with Perfetto or Instruments, not `console.time`; signing bytes against published test vectors or a reference implementation, not against our own output.
4. **What does the repo already have?** Scripts, harnesses, CI checks, repo skills, `ast-grep` rules, earlier `.verification/` investigations, and PRs or threads on the same topic.
5. **Recommendation.** Build on X and write only the glue. If custom code is unavoidable, name what it replaces and why nothing in fields 2 and 4 fits.

## Where to look, cheapest first

| Source | How |
|---|---|
| This machine | `command -v <tool>`, `brew list`, `~/dotfiles/docs/tools/`; for each installed candidate, its `--help` or `tldr` for the subcommand that does the job |
| The repo | `scripts/`, `bin/`, package scripts, CI workflows, repo skills, `.verification/`, the agents file |
| Earlier work | `gh pr list --search <topic> --state all`, `t3_thread_search`, the ledger |
| The ecosystem | The framework's own docs and tooling, the specialist's standard tools, then a web search for "<problem> cli" or "<problem> library" |

## Rules

- The plan's first build step uses the tool the note recommends. A plan that opens with "write a script that…" when field 2 or 4 names a tool has skipped the gate.
- Ruling out an installed tool takes evidence: its help output or a dry run showing it cannot do the job. A missing flag is a reason to wrap the tool, not to replace it.
- Prefer a measurement from outside the code you write: an independent reference, a published vector, a profiler. Your own output is not an oracle.
- **Performance work:** climb the ladder in [references/perf-ladder.md](references/perf-ladder.md) one rung at a time, cheapest instrument first, and record which rung found the problem.
- **Greenfield in an unknown domain:** compare two or three candidate frameworks on criteria Peter cares about (speed, size, agent and tool support, native versus web), then write the spike's expected measurement into the contract, spike the riskiest assumption, and record the result in the note before the full plan.
- Skip the note for a bug with a reproduction, maintenance that adds no new capability, or a task whose tool Peter already named. His choice is a decision, not a candidate.

## Template

```markdown
# Prior art: <task>

1. Expert: <role>
2. They reach for: <tool> (why it is standard); <tool> (why)
3. They measure: <metric> with <instrument>
4. Repo already has: <path or PR> (what it covers, what it misses)
5. Recommendation: build on <X>; custom glue: <what, why nothing fits>

Searched: <commands and sources, 30-minute box>
```
