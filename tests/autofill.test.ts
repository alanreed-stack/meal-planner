import { describe, expect, it } from "vitest";
import { proposeFill, reshuffleDay, type Cand, type FillInput } from "@/lib/autofill";

// A small seeded random generator, so every run picks the same dinners.
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const monday = "2026-11-09";
const days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.parse(monday + "T00:00:00Z") + i * 86_400_000);
  return d.toISOString().slice(0, 10);
});

const proteins = ["chicken", "beef", "fish", "pork", "turkey", "shrimp"];
const cand = (i: number, over: Partial<Cand> = {}): Cand => ({
  id: `r${i}`,
  name: `Recipe ${i}`,
  diet: "both",
  favorite: false,
  minutes: 30,
  protein: proteins[i % proteins.length],
  lastDay: null,
  ...over,
});
const many = (n: number, over: (i: number) => Partial<Cand> = () => ({})) =>
  Array.from({ length: n }, (_, i) => cand(i, over(i)));

const input = (cands: Cand[], over: Partial<FillInput> = {}): FillInput => ({
  days,
  existing: {},
  cands,
  mode: "home",
  monday,
  ...over,
});

const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("proposeFill", () => {
  it("fills every empty day when there are enough recipes", () => {
    for (const s of seeds) {
      const out = proposeFill(input(many(12)), days, seeded(s));
      expect(days.every((d) => out[d])).toBe(true);
    }
  });

  it("never picks the same recipe twice", () => {
    for (const s of seeds) {
      const ids = Object.values(proposeFill(input(many(12)), days, seeded(s))).map((c) => c?.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("does not serve the same meat two nights in a row", () => {
    for (const s of seeds) {
      const out = proposeFill(input(many(18)), days, seeded(s));
      for (let i = 1; i < days.length; i++) {
        expect(out[days[i]]?.protein).not.toBe(out[days[i - 1]]?.protein);
      }
    }
  });

  it("works around dinners already planned", () => {
    const existing = { [days[2]]: { id: "r0", protein: "chicken" } };
    for (const s of seeds) {
      const open = days.filter((d) => d !== days[2]);
      const out = proposeFill(input(many(18), { existing }), open, seeded(s));
      expect(Object.values(out).some((c) => c?.id === "r0")).toBe(false); // already on the plan
      expect(out[days[1]]?.protein).not.toBe("chicken");
      expect(out[days[3]]?.protein).not.toBe("chicken");
    }
  });

  it("skips family-only meals in a home week and keto-only meals in a travel week", () => {
    const cands = many(14, (i) => ({ diet: i % 3 === 0 ? "family" : i % 3 === 1 ? "keto" : "both" }));
    for (const s of seeds) {
      const home = Object.values(proposeFill(input(cands, { mode: "home" }), days, seeded(s)));
      expect(home.every((c) => c && c.diet !== "family")).toBe(true);
      const travel = Object.values(proposeFill(input(cands, { mode: "travel" }), days, seeded(s)));
      expect(travel.every((c) => c && c.diet !== "keto")).toBe(true);
    }
  });

  it("avoids what was made in the last 3 weeks when there is something else", () => {
    const recent = "2026-11-02"; // a week before
    const cands = many(16, (i) => (i < 8 ? { lastDay: recent } : {}));
    for (const s of seeds) {
      const out = proposeFill(input(cands), days, seeded(s));
      expect(Object.values(out).every((c) => c && Number(c.id.slice(1)) >= 8)).toBe(true);
    }
  });

  it("relaxes the repeat window rather than leaving days empty", () => {
    const cands = many(8, () => ({ lastDay: "2026-11-02" }));
    const out = proposeFill(input(cands), days, seeded(3));
    expect(days.filter((d) => out[d]).length).toBeGreaterThanOrEqual(5);
  });

  it("returns null for a day when nothing fits", () => {
    const out = proposeFill(input([]), [days[0]], seeded(1));
    expect(out[days[0]]).toBeNull();
  });

  it("suggests thumbs-down recipes far less often", () => {
    const cands = [cand(0, { rating: -1, protein: "beef" }), cand(1, { protein: "chicken" })];
    let down = 0;
    for (let s = 1; s <= 200; s++) {
      const out = proposeFill(input(cands), [days[0]], seeded(s));
      if (out[days[0]]?.id === "r0") down++;
    }
    expect(down).toBeLessThan(60); // would be about 100 with no penalty
  });
});

describe("reshuffleDay", () => {
  it("offers a different recipe than the one shown", () => {
    const i = input(many(12));
    const chosen = proposeFill(i, days, seeded(5));
    for (const day of days) {
      const next = reshuffleDay(i, chosen, day, seeded(9));
      expect(next?.id).not.toBe(chosen[day]?.id);
    }
  });

  it("keeps the current one when there is no alternative", () => {
    const only = many(1);
    const i = input(only, { days: [days[0]] });
    const chosen = proposeFill(i, [days[0]], seeded(1));
    expect(reshuffleDay(i, chosen, days[0], seeded(2))?.id).toBe("r0");
  });
});
