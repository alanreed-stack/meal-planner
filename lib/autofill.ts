// Picks dinners for the empty days of a week. Pure functions, so the browser can reshuffle instantly.

export type Cand = {
  id: string;
  name: string;
  diet: "both" | "family" | "keto";
  favorite: boolean;
  minutes: number;
  protein: string;
  lastDay: string | null; // most recent time it was planned before this week
};

export type FillInput = {
  days: string[]; // every day of the week, Monday first
  existing: Record<string, { id: string | null; protein: string | null }>; // dinners already planned
  cands: Cand[];
  mode: "home" | "travel";
  monday: string;
};

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / DAY_MS);

function eligible(c: Cand, input: FillInput, minGapDays: number): boolean {
  if (input.mode === "home" && c.diet === "family") return false; // would need a keto plate too
  if (input.mode === "travel" && c.diet === "keto") return false;
  if (c.lastDay && daysBetween(input.monday, c.lastDay) < minGapDays) return false;
  return true;
}

function pick<T>(items: { item: T; w: number }[], rng: () => number): T | null {
  const total = items.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of items) {
    r -= x.w;
    if (r <= 0) return x.item;
  }
  return items[items.length - 1].item;
}

/** Chooses one recipe for `day`, given everything else already chosen (`chosen` maps day -> candidate). */
function chooseFor(
  day: string,
  input: FillInput,
  chosen: Record<string, Cand | null>,
  exclude: Set<string>,
  rng: () => number
): Cand | null {
  const idx = input.days.indexOf(day);
  const proteinOf = (d: string | undefined) => {
    if (!d) return null;
    return chosen[d]?.protein ?? input.existing[d]?.protein ?? null;
  };
  const prev = proteinOf(input.days[idx - 1]);
  const next = proteinOf(input.days[idx + 1]);

  const usedIds = new Set<string>(exclude);
  const perProtein: Record<string, number> = {};
  for (const d of input.days) {
    if (d === day) continue;
    const id = chosen[d]?.id ?? input.existing[d]?.id ?? null;
    if (id) usedIds.add(id);
    const p = proteinOf(d);
    if (p && p !== "none") perProtein[p] = (perProtein[p] ?? 0) + 1;
  }

  // Strictest first: not in the last 3 weeks, never the same meat two nights running.
  // If that leaves nothing, relax the repeat window, and only then the back-to-back rule.
  const passes: [number, boolean][] = [[21, false], [7, false], [0, false], [0, true]];
  for (const [gap, allowAdjacent] of passes) {
    const pool = input.cands
      .filter((c) => !usedIds.has(c.id) && eligible(c, input, gap))
      .map((c) => {
        let w = c.favorite ? 3 : 1;
        if (c.protein !== "none") {
          if (!allowAdjacent && (c.protein === prev || c.protein === next)) w = 0;
          const n = perProtein[c.protein] ?? 0;
          if (n >= 3) w = 0;
          else if (n === 2) w *= 0.25;
        }
        return { item: c, w };
      })
      .filter((x) => x.w > 0);
    const got = pick(pool, rng);
    if (got) return got;
  }
  return null;
}

export function proposeFill(
  input: FillInput,
  emptyDays: string[],
  rng: () => number = Math.random
): Record<string, Cand | null> {
  const chosen: Record<string, Cand | null> = {};
  // Visit days in a shuffled order so the first days don't always get the favorites.
  const order = [...emptyDays].sort(() => rng() - 0.5);
  for (const d of order) chosen[d] = chooseFor(d, input, chosen, new Set(), rng);
  return chosen;
}

export function reshuffleDay(
  input: FillInput,
  chosen: Record<string, Cand | null>,
  day: string,
  rng: () => number = Math.random
): Cand | null {
  const current = chosen[day];
  const next = chooseFor(day, input, chosen, new Set(current ? [current.id] : []), rng);
  return next ?? current ?? null;
}
