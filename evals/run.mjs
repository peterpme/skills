#!/usr/bin/env node
// Replay skill fixtures across versions.
// Usage: node evals/run.mjs [--fixture <name>] [refs...]
// Each ref is a git ref, or "." for the working tree. Default: main vs working tree.
// Env: RUNS=5 runs per fixture (default 3), JUDGE=0 skips the faithfulness judge.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";

const here = resolve(import.meta.dirname);
const repo = resolve(here, "..");
const { values, positionals } = parseArgs({ options: { fixture: { type: "string" } }, allowPositionals: true });
const refs = positionals.length ? positionals : ["main", "."];
const runs = Number(process.env.RUNS ?? 3);
const judge = process.env.JUDGE !== "0";
const checks = JSON.parse(readFileSync(join(here, "checks.json"), "utf8"));
const fixtures = readdirSync(join(here, "fixtures"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -3))
  .filter((name) => !values.fixture || name === values.fixture)
  .sort();
if (!fixtures.length) throw new Error(`No fixture matched ${values.fixture}`);
const skills = new Set(fixtures.map((name) => checks[name].skill ?? "tldr"));
const work = join(here, ".work");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
// Ignore user settings, hooks, MCP servers, and tools so runs are cheap and comparable.
const iso = ["--setting-sources", "project", "--strict-mcp-config", "--tools=", "--output-format", "json"];
const models = readFileSync(join(repo, "global/models.tsv"), "utf8").split("\n").map((l) => l.split("\t"));
function modelArgs(role) {
  const [, , , model, effort] = models.find((r) => r[0] === role && r[2] === "claudeAgent");
  return ["--model", model, "--effort", effort];
}
function claude(args, input) {
  const out = JSON.parse(execFileSync("claude", ["-p", ...iso, ...args], { input, cwd: work, encoding: "utf8" }));
  if (out.is_error) throw new Error(out.result);
  return out;
}

// Load each version as a plugin alongside any installed skills.
const variants = refs.map((ref) => {
  const name = ref === "." ? "working" : `ref-${ref.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const dir = join(work, "plugins", name);
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(join(dir, ".claude-plugin/plugin.json"), JSON.stringify({ name }));
  for (const skill of skills) {
    const path = `skills/${skill}/SKILL.md`;
    const contents = ref === "."
      ? readFileSync(join(repo, skill, "SKILL.md"), "utf8")
      : execFileSync("git", ["show", `${ref}:${skill}/SKILL.md`], { cwd: repo, encoding: "utf8" });
    mkdirSync(join(dir, "skills", skill), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }
  return { ref, name, dir };
});

function gradePatterns(c, text) {
  return {
    mustMatch: c.mustMatch.every((p) => new RegExp(p, "i").test(text)),
    mustNotMatch: c.mustNotMatch.every((p) => !new RegExp(p, "i").test(text)),
  };
}

function gradeTldr(c, text) {
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
  // No word cap in the skill: a line is one short sentence. The eval backstop flags paragraphs only.
  const body = lines.filter((l) => !header.test(l));
  const longLines = body.filter((l) => words(l) > 30);
  const res = {
    startsWithTldr: /^\*\*TLDR:\*\*/.test(lines[0] ?? ""),
    doneMax3: (sections.Done ?? []).length <= 3,
    nextMax3: (sections.Next ?? []).length <= 3,
    wordsMax30: longLines.length === 0,
    noExtraHeaders: !lines.some((l) => /^#|^\*\*[^*]+\*\*:?$/.test(l) && !header.test(l)),
    decisionsWithinSource: (sections.Decide ?? []).length <= c.maxDecisions,
    ...gradePatterns(c, text),
  };
  return { res, longLines, maxWords: Math.max(0, ...body.map(words)) };
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
for (const fixture of fixtures) {
  const c = checks[fixture];
  const skill = c.skill ?? "tldr";
  const tldr = skill === "tldr";
  const [, task, source] = readFileSync(join(here, "fixtures", `${fixture}.md`), "utf8").trim().match(/^TASK: (.*)\n+([\s\S]*)$/);
  for (let r = 0; r < runs; r++) {
    // Seed one session whose last assistant turn is the fixture, framed as a teammate's report so
    // the model doesn't flag its claims as unbacked by tool calls. Fork it per version.
    const seed = tldr && claude([], `A teammate was asked: "${task}"\nTheir final report is between the markers. Reply with exactly that report and nothing else.\n<<<\n${source}\n>>>`);
    for (const v of variants) {
      const args = tldr ? ["--resume", seed.session_id, "--fork-session"] : modelArgs("coordinator");
      const prompt = `/${v.name}:${skill}${tldr ? "" : ` ${task}\n\n${source}`}`;
      const out = claude([...args, "--plugin-dir", v.dir], prompt);
      const text = out.result.trim();
      const { res, longLines, maxWords } = tldr ? gradeTldr(c, text) : { res: gradePatterns(c, text) };
      let verdict = "skipped";
      if (tldr && judge) {
        verdict = claude(modelArgs("investigate"), JUDGE_PROMPT(task, source, text)).result.trim();
        res.faithful = /^PASS/i.test(verdict);
      }
      const passed = Object.values(res).filter(Boolean).length;
      const total = Object.keys(res).length;
      if (!tldr && passed !== total) process.exitCode = 1;
      totals[v.ref] ??= { passed: 0, total: 0 };
      totals[v.ref].passed += passed;
      totals[v.ref].total += total;
      rows.push({ fixture, version: v.ref, run: r, score: `${passed}/${total}`, maxWords, failed: Object.keys(res).filter((k) => !res[k]).join(",") || "-" });
      writeFileSync(join(work, `${fixture}.${v.name}.${r}.md`), `${text}\n\n---\n${JSON.stringify({ res, longLines, maxWords }, null, 1)}\n\nJUDGE:\n${verdict}\n`);
    }
  }
}
// Remove the throwaway sessions this run created.
rmSync(join(homedir(), ".claude/projects", work.replace(/[^A-Za-z0-9]/g, "-")), { recursive: true, force: true });
console.table(rows);
console.table(Object.fromEntries(Object.entries(totals).map(([k, t]) => [k, `${t.passed}/${t.total} (${Math.round((100 * t.passed) / t.total)}%)`])));
console.log(`Briefs and judge notes: ${work}`);
