#!/usr/bin/env node
// Orchestrate eval: replay Peter's past build tasks at their starting commit and grade each
// variant's plan against what he later had to correct. See README.md in this folder.
//
// node evals/orchestrate/run.mjs [ref|.]...     (default: main .)
// env: SKILL_EVAL_HOME CASES SPLIT(train|holdout|all) REPS MODEL JUDGE_MODEL CONCURRENCY MAX_TURNS TIMEOUT_MIN
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { score } from "./score.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const evalHome = process.env.SKILL_EVAL_HOME ?? join(homedir(), ".local/share/skill-evals/orchestrate");
const refs = process.argv.slice(2).length ? process.argv.slice(2) : ["main", "."];
const env = (k, d) => process.env[k] ?? d;
const REPS = Number(env("REPS", 1));
const MODEL = env("MODEL", "claude-opus-5-5");
const JUDGE_MODEL = env("JUDGE_MODEL", "gpt-6.1-sol");
const CONCURRENCY = Number(env("CONCURRENCY", 3));
const MAX_TURNS = env("MAX_TURNS", "80");
const TIMEOUT_MS = Number(env("TIMEOUT_MIN", 25)) * 60_000;
const SPLIT = env("SPLIT", "train");
const expand = (p) => p.replace(/^~(?=\/)/, homedir());

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = join(evalHome, "runs", stamp);
mkdirSync(runDir, { recursive: true });

// ---------- cases ----------
const caseIds = env("CASES", "").split(",").filter(Boolean);
const cases = readdirSync(join(evalHome, "cases"))
  .filter((id) => existsSync(join(evalHome, "cases", id, "case.json")))
  .map((id) => JSON.parse(readFileSync(join(evalHome, "cases", id, "case.json"), "utf8")))
  .filter((c) => (caseIds.length ? caseIds.includes(c.id) : SPLIT === "all" || (c.split ?? "train") === SPLIT));
if (!cases.length) throw new Error(`no cases match (SPLIT=${SPLIT} CASES=${caseIds.join(",")})`);

// ---------- variants: global AGENTS.md + every skill at a ref, as one plugin ----------
const variants = refs.map((ref) => {
  const name = ref === "." ? "working" : ref.replace(/[^a-z0-9]+/gi, "-");
  const src = join(runDir, "src", name);
  mkdirSync(src, { recursive: true });
  if (ref === ".") {
    const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: repo, encoding: "utf8" })
      .split("\0").filter(Boolean);
    for (const f of files) if (existsSync(join(repo, f))) cpSync(join(repo, f), join(src, f), { recursive: true });
  } else {
    execFileSync("bash", ["-c", `git -C "${repo}" archive "${ref}" | tar -x -C "${src}"`]);
  }
  const plugin = join(runDir, "plugins", name);
  mkdirSync(join(plugin, ".claude-plugin"), { recursive: true });
  writeFileSync(join(plugin, ".claude-plugin/plugin.json"), JSON.stringify({ name: "skills" }));
  const skills = readdirSync(src).filter((d) => existsSync(join(src, d, "SKILL.md")));
  for (const s of skills) cpSync(join(src, s), join(plugin, "skills", s), { recursive: true });
  // Point skill paths in the instructions at this variant, not the live install.
  const agents = readFileSync(join(src, "global/AGENTS.md"), "utf8")
    .replaceAll("~/.agents/skills/", join(plugin, "skills") + "/")
    .replaceAll("~/skills/", src + "/");
  writeFileSync(join(plugin, "AGENTS.md"), agents);
  return { ref, name, plugin, skills };
});

// ---------- a clone of each case repo cut at base, with no later history ----------
function clone(c) {
  const dir = join(evalHome, "work", c.id, "repo");
  if (existsSync(join(dir, ".git")) && execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() === c.base) {
    execFileSync("git", ["-C", dir, "checkout", "-q", "--force", "--detach", c.base]);
    execFileSync("git", ["-C", dir, "clean", "-qfdx"]);
    return dir;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "fetch", "-q", "--depth", "300", `file://${expand(c.repo)}`, c.base]);
  execFileSync("git", ["-C", dir, "checkout", "-q", "--detach", "FETCH_HEAD"]);
  return dir;
}

const READ_TOOLS = ["Read", "Grep", "Glob", "Skill", "Agent", "Bash(git log:*)", "Bash(git show:*)", "Bash(git grep:*)",
  "Bash(git diff:*)", "Bash(git blame:*)", "Bash(git ls-files:*)", "Bash(ls:*)", "Bash(rg:*)", "Bash(fd:*)",
  "Bash(wc:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(sed -n:*)", "Bash(find:*)", "Bash(jq:*)"];

const wrapper = (prompt) => `${prompt}

---
(Eval harness note: start this task the way you normally would. In this session you can read the repository and use read-only commands, but file edits, builds, network access and messaging are disabled. When you reach the point where you would start changing files, stop and post the message you would send Peter at that point, with your full plan and anything you need from him.)`;

function run(cmd, args, { input, cwd, timeout }) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => p.kill("SIGTERM"), timeout);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => { clearTimeout(timer); done({ code, out, err }); });
    p.stdin.end(input ?? "");
  });
}

async function plan(c, v, dir, base) {
  const args = ["-p", "--setting-sources", "project", "--strict-mcp-config", "--plugin-dir", v.plugin,
    "--append-system-prompt-file", join(v.plugin, "AGENTS.md"), "--model", MODEL, "--output-format", "stream-json", "--verbose",
    "--max-turns", MAX_TURNS, "--allowedTools", ...READ_TOOLS, "--disallowedTools", "Edit", "Write", "NotebookEdit",
    "WebFetch", "WebSearch"];
  const r = await run("claude", args, { input: wrapper(c.prompt), cwd: dir, timeout: TIMEOUT_MS });
  writeFileSync(`${base}.transcript.jsonl`, r.out);
  const events = r.out.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  const skills = events.flatMap((e) => (e.type === "assistant" ? e.message?.content ?? [] : []))
    .filter((b) => b.type === "tool_use" && (b.name === "Skill" || (b.name === "Read" && /SKILL\.md$/.test(b.input?.file_path ?? ""))))
    .map((b) => (b.name === "Skill" ? b.input?.skill ?? "?" : b.input.file_path.split("/").at(-2)));
  const j = events.find((e) => e.type === "result");
  if (!j) return { text: "", cost: 0, turns: 0, ms: 0, skills, error: `exit ${r.code}: ${(r.err || r.out).slice(-300)}` };
  return { text: j.result ?? "", cost: j.total_cost_usd ?? 0, turns: j.num_turns ?? 0, ms: j.duration_ms ?? 0, skills, error: j.is_error ? j.subtype : null };
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["interventions", "questions", "waits_for_peter"],
  properties: {
    interventions: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "verdict", "evidence", "note"],
      properties: { id: { type: "string" }, verdict: { enum: ["prevented", "asked", "missed", "contradicted"] },
        evidence: { type: "string" }, note: { type: "string" } } } },
    questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["question", "label"],
      properties: { question: { type: "string" }, label: { enum: ["needed", "routine"] } } } },
    waits_for_peter: { type: "boolean" },
  },
};
writeFileSync(join(runDir, "judge-schema.json"), JSON.stringify(SCHEMA));

const judgePrompt = (c, text) => `You grade an AI agent's plan for a software task, written before any code. Later in the real thread, the person who asked (Peter) had to step in with the messages below. Decide, for each one, whether this plan would have made it unnecessary.

Verdicts:
- prevented: the plan, as written, commits to the behavior in "expect" (or something equally good), so Peter would not have needed to say it. Vague intentions ("ensure quality", "follow best practices") do not count; the plan must name the concrete check, decision, constraint or step.
- asked: the plan explicitly asks Peter about this point (a question or a stated default awaiting his confirmation).
- missed: the plan does not address it.
- contradicted: the plan commits to what Peter later corrected.
Quote the plan's words in "evidence" (empty when missed). Keep "note" to one sentence.

Then list every question the plan asks Peter. Label it "needed" if only Peter could answer it and the answer changes what gets built; "routine" if the agent should have decided it itself (naming, file layout, test structure, an equivalent choice, something the repo or request already answers).
Set waits_for_peter to true if the plan says it will not start until Peter answers; false if it proceeds on stated defaults or asks nothing.

Task as Peter wrote it:
<<<
${c.prompt}
>>>

Peter's later messages on this task (hidden from the agent):
${JSON.stringify(c.interventions.map(({ id, quote, kind, expect }) => ({ id, quote, kind, expect })), null, 1)}

The plan:
<<<
${text}
>>>`;

async function judge(c, text, out) {
  if (!text.trim()) return null;
  const r = await run("codex", ["exec", "-m", JUDGE_MODEL, "-c", 'model_reasoning_effort="high"', "-s", "read-only",
    "--skip-git-repo-check", "--ephemeral", "--output-schema", join(runDir, "judge-schema.json"), "-o", out, "-"],
    { input: judgePrompt(c, text), cwd: runDir, timeout: 15 * 60_000 });
  try { return JSON.parse(readFileSync(out, "utf8")); } catch { return { error: `judge exit ${r.code}: ${r.err.slice(-300)}` }; }
}


// ---------- run ----------
const jobs = [];
for (const c of cases) for (const v of variants) for (let rep = 1; rep <= REPS; rep++) jobs.push({ c, v, rep });
const dirs = Object.fromEntries(cases.map((c) => [c.id, clone(c)]));
console.log(`run ${runDir}\n${cases.length} cases x ${variants.length} variants x ${REPS} reps = ${jobs.length} runs, model ${MODEL}, judge ${JUDGE_MODEL}`);

const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { c, v, rep } = jobs[next++];
    const base = join(runDir, c.id, `${v.name}-${rep}`);
    mkdirSync(dirname(base), { recursive: true });
    const p = await plan(c, v, dirs[c.id], base);
    writeFileSync(`${base}.plan.md`, p.text || `(no plan: ${p.error})`);
    const g = await judge(c, p.text, `${base}.judge.json`);
    const s = score(c, g);
    const counts = { prevented: 0, asked: 0, missed: 0, contradicted: 0 };
    for (const i of g?.interventions ?? []) counts[i.verdict]++;
    const row = { case: c.id, split: c.split ?? "train", variant: v.name, rep, score: s, ...counts,
      routine: (g?.questions ?? []).filter((q) => q.label === "routine").length, waits: g?.waits_for_peter ?? null,
      skills: [...new Set(p.skills)], cost: p.cost, turns: p.turns, minutes: Math.round(p.ms / 6000) / 10, error: (p.text ? null : p.error) ?? g?.error ?? null };
    results.push(row);
    appendFileSync(join(runDir, "results.jsonl"), JSON.stringify(row) + "\n");
    console.log(`${c.id} ${v.name}#${rep}: ${s ?? "ERROR"}  P${counts.prevented} A${counts.asked} M${counts.missed} C${counts.contradicted}  ${row.minutes}m $${p.cost.toFixed(2)} skills:${row.skills.join("+") || "none"}${row.error ? "  " + row.error : ""}`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log("\nvariant      mean   n  prevented asked missed contradicted routineQ  cost");
for (const v of variants) {
  const rs = results.filter((r) => r.variant === v.name && r.score !== null);
  const sum = (k) => rs.reduce((a, r) => a + r[k], 0);
  console.log(`${v.name.padEnd(12)} ${mean(rs.map((r) => r.score)).toFixed(3)} ${String(rs.length).padStart(3)}  ${String(sum("prevented")).padStart(9)} ${String(sum("asked")).padStart(5)} ${String(sum("missed")).padStart(6)} ${String(sum("contradicted")).padStart(12)} ${String(sum("routine")).padStart(8)}  $${sum("cost").toFixed(2)}`);
}
console.log(`\nper case: node ${join(here, "report.mjs")} ${runDir}`);
