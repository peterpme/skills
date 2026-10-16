#!/usr/bin/env node
// Compare tldr/SKILL.md across versions on fixed agent responses.
// Usage: node evals/run.mjs [refs...]   e.g. node evals/run.mjs main .
// Each ref is a git ref, or "." for the working tree. Default: main vs working tree.
// Env: RUNS=5 runs per fixture (default 3), JUDGE=0 skips the faithfulness judge.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const here = resolve(import.meta.dirname);
const repo = resolve(here, "..");
const refs = process.argv.length > 2 ? process.argv.slice(2) : ["main", "."];
const runs = Number(process.env.RUNS ?? 3);
const judge = process.env.JUDGE !== "0";
const checks = JSON.parse(readFileSync(join(here, "checks.json"), "utf8"));
const work = join(here, ".work");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
// Ignore user settings, hooks, MCP servers, and tools so runs are cheap and comparable.
const iso = ["--setting-sources", "project", "--strict-mcp-config", "--tools=", "--output-format", "json"];
const claude = (args, input) =>
  JSON.parse(execFileSync("claude", ["-p", ...iso, ...args], { input, cwd: work, encoding: "utf8" }));

// Wrap each version as a throwaway plugin so it loads as /<name>:tldr next to any installed /tldr.
const variants = refs.map((ref) => {
  const name = ref === "." ? "working" : `ref-${ref.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const dir = join(work, "plugins", name);
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  mkdirSync(join(dir, "skills/tldr"), { recursive: true });
  writeFileSync(join(dir, ".claude-plugin/plugin.json"), JSON.stringify({ name }));
  const skill = ref === "."
    ? readFileSync(join(repo, "tldr/SKILL.md"), "utf8")
    : execFileSync("git", ["show", `${ref}:tldr/SKILL.md`], { cwd: repo, encoding: "utf8" });
  writeFileSync(join(dir, "skills/tldr/SKILL.md"), skill);
  return { ref, name, dir };
});

function grade(fixture, text) {
  const c = checks[fixture];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const header = /^\*\*(Decide|Done|Next)\*\*$/;
  const sections = {};
  let cur = null;
  for (const l of lines) {
    const h = l.match(header);
    if (h) { cur = h[1]; sections[cur] = []; continue; }
    if (cur && /^(-|\d+\.)\s/.test(l)) sections[cur].push(l);
  }
  const words = (l) => l.replace(/^(-|\d+\.)\s+/, "").replace(/\*\*TLDR:\*\*/, "").replace(/[*`→]/g, " ").split(/\s+/).filter(Boolean).length;
  const longLines = lines.filter((l) => !header.test(l) && words(l) > 15);
  const res = {
    startsWithTldr: /^\*\*TLDR:\*\*/.test(lines[0] ?? ""),
    doneMax3: (sections.Done ?? []).length <= 3,
    nextMax3: (sections.Next ?? []).length <= 3,
    wordsMax15: longLines.length === 0,
    noExtraHeaders: !lines.some((l) => /^#|^\*\*[^*]+\*\*:?$/.test(l) && !header.test(l)),
    decisionsWithinSource: (sections.Decide ?? []).length <= c.maxDecisions,
    mustMatch: c.mustMatch.every((p) => new RegExp(p, "i").test(text)),
    mustNotMatch: c.mustNotMatch.every((p) => !new RegExp(p, "i").test(text)),
  };
  return { res, longLines };
}

const JUDGE_PROMPT = (task, source, brief) => `TASK is what the reader asked for. SOURCE is an agent's report on it. BRIEF is a rewrite that must use only SOURCE. BRIEF's format requires numbered decisions with a recommended pick: a pick is fine if SOURCE made that choice, leaned that way, or named it as the reader's next action.

Pointing out, under Next, where SOURCE is wrong, unclear, or falls short of TASK is allowed.

FAIL if BRIEF: gives a reason SOURCE did not give; offers an option, step, or suggestion SOURCE did not mention; lists under Done something that was already true before the work; or states a fact SOURCE does not state.

TASK:
${task}

SOURCE:
${source}

BRIEF:
${brief}

Reply PASS or FAIL on the first line, then list each violation with a quote.`;

const rows = [];
const totals = {};
for (const f of readdirSync(join(here, "fixtures")).filter((f) => f.endsWith(".md")).sort()) {
  const fixture = f.replace(/\.md$/, "");
  const [, task, source] = readFileSync(join(here, "fixtures", f), "utf8").trim().match(/^TASK: (.*)\n+([\s\S]*)$/);
  for (let r = 0; r < runs; r++) {
    // Seed one session whose last assistant turn is the fixture, framed as a teammate's report so
    // the model doesn't flag its claims as unbacked by tool calls. Fork it per version.
    const seed = claude([], `A teammate was asked: "${task}"\nTheir final report is between the markers. Reply with exactly that report and nothing else.\n<<<\n${source}\n>>>`);
    for (const v of variants) {
      const out = claude(["--resume", seed.session_id, "--fork-session", "--plugin-dir", v.dir], `/${v.name}:tldr`);
      const text = out.result.trim();
      const { res, longLines } = grade(fixture, text);
      let verdict = "skipped";
      if (judge) {
        verdict = claude(["--model", "sonnet"], JUDGE_PROMPT(task, source, text)).result.trim();
        res.faithful = /^PASS/i.test(verdict);
      }
      const passed = Object.values(res).filter(Boolean).length;
      const total = Object.keys(res).length;
      totals[v.ref] ??= { passed: 0, total: 0 };
      totals[v.ref].passed += passed;
      totals[v.ref].total += total;
      rows.push({ fixture, version: v.ref, run: r, score: `${passed}/${total}`, failed: Object.keys(res).filter((k) => !res[k]).join(",") || "-" });
      writeFileSync(join(work, `${fixture}.${v.name}.${r}.md`), `${text}\n\n---\n${JSON.stringify({ res, longLines }, null, 1)}\n\nJUDGE:\n${verdict}\n`);
    }
  }
}
// Remove the throwaway sessions this run created.
rmSync(join(homedir(), ".claude/projects", work.replace(/[^A-Za-z0-9]/g, "-")), { recursive: true, force: true });
console.table(rows);
console.table(Object.fromEntries(Object.entries(totals).map(([k, t]) => [k, `${t.passed}/${t.total} (${Math.round((100 * t.passed) / t.total)}%)`])));
console.log(`Briefs and judge notes: ${work}`);
