// The one line under the Week page header: how many dinners, which meats, about what it costs.

export type WeekCost = {
  amount: number;
  /** True when it comes from the built shopping list, which counts shared packages once. */
  exact: boolean;
};

/** "5 dinners · chicken 2, beef 2, fish 1 · about $140". */
export function weekSummary(w: { dinners: number; proteins: string[]; cost: WeekCost | null }): string {
  if (w.dinners === 0) return "No dinners planned yet.";
  const counts = new Map<string, number>();
  for (const p of w.proteins) if (p && p !== "none") counts.set(p, (counts.get(p) ?? 0) + 1);
  const meats = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([p, n]) => `${p} ${n}`);
  const parts = [`${w.dinners} dinner${w.dinners === 1 ? "" : "s"}`];
  if (meats.length) parts.push(meats.join(", "));
  if (w.cost && w.cost.amount > 0) parts.push(`${w.cost.exact ? "about" : "up to about"} $${Math.round(w.cost.amount)}`);
  return parts.join(" · ");
}
