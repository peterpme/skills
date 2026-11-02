#!/usr/bin/env node
// node evals/orchestrate/report.mjs <run dir> [--misses]
// Per-case mean score for each variant, then (with --misses) every missed or contradicted
// intervention with the judge's note, grouped by variant: the input for the next skill change.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { score } from "./score.mjs";

const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error("usage: report.mjs <run dir> [--misses]");
const evalHome = process.env.SKILL_EVAL_HOME ?? join(homedir(), ".local/share/skill-evals/orchestrate");
// Rescore from the saved judge output so scoring changes apply to old runs too.
const rows = readFileSync(join(dir, "results.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((r) => {
  const f = join(dir, r.case, `${r.variant}-${r.rep}.judge.json`);
  const c = JSON.parse(readFileSync(join(evalHome, "cases", r.case, "case.json"), "utf8"));
  return { ...r, score: existsSync(f) ? score(c, JSON.parse(readFileSync(f, "utf8"))) : null };
});
const variants = [...new Set(rows.map((r) => r.variant))];
const cases = [...new Set(rows.map((r) => r.case))].sort();
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x) => (Number.isNaN(x) ? "  -  " : x.toFixed(2).padStart(5));

console.log(`case`.padEnd(44) + variants.map((v) => v.padStart(10)).join("") + "   spread");
for (const c of cases) {
  const cells = variants.map((v) => rows.filter((r) => r.case === c && r.variant === v && r.score !== null).map((r) => r.score));
  const spread = Math.max(...cells.map((s) => (s.length > 1 ? Math.max(...s) - Math.min(...s) : 0)));
  const split = rows.find((r) => r.case === c).split === "holdout" ? " (holdout)" : "";
  console.log((c + split).padEnd(44) + cells.map((s) => fmt(mean(s)).padStart(10)).join("") + `   ${spread.toFixed(2)}`);
}
console.log("mean".padEnd(44) + variants.map((v) => fmt(mean(rows.filter((r) => r.variant === v && r.score !== null).map((r) => r.score))).padStart(10)).join(""));
const errors = rows.filter((r) => r.error);
if (errors.length) console.log(`\n${errors.length} runs with errors: ` + errors.map((r) => `${r.case}/${r.variant}#${r.rep}: ${r.error}`).join("; "));

if (flag === "--misses") {
  for (const v of variants) {
    console.log(`\n## ${v}: missed or contradicted`);
    for (const r of rows.filter((r) => r.variant === v)) {
      const f = join(dir, r.case, `${v}-${r.rep}.judge.json`);
      if (!existsSync(f)) continue;
      const g = JSON.parse(readFileSync(f, "utf8"));
      const c = JSON.parse(readFileSync(join(evalHome, "cases", r.case, "case.json"), "utf8"));
      for (const i of g.interventions ?? []) {
        if (i.verdict !== "missed" && i.verdict !== "contradicted") continue;
        const ci = c.interventions.find((x) => x.id === i.id) ?? {};
        console.log(`- ${r.case}#${r.rep} ${i.id} [${i.verdict}, ${ci.kind}, ${ci.knowable ? "knowable" : "only Peter"}] expect: ${ci.expect}\n    judge: ${i.note}`);
      }
      for (const q of (g.questions ?? []).filter((q) => q.label === "routine")) console.log(`- ${r.case}#${r.rep} routine question: ${q.question}`);
    }
  }
}
