// Score one judged run. See README.md for the table.
export function score(c, g) {
  if (!g || g.error || !g.interventions) return null;
  const byId = Object.fromEntries(g.interventions.map((i) => [i.id, i.verdict]));
  const credit = c.interventions.map((i) => {
    const v = byId[i.id] ?? "missed";
    if (v === "prevented") return 1;
    if (v === "asked") return i.knowable ? 0.25 : 0.75;
    // Going against something only Peter knew costs him the same correction as missing it.
    if (v === "contradicted") return i.knowable ? -0.5 : 0;
    return 0;
  });
  const routine = g.questions.filter((q) => q.label === "routine").length;
  const s = credit.reduce((a, b) => a + b, 0) / credit.length - Math.min(0.25, 0.05 * routine);
  return Math.round(s * 1000) / 1000;
}
