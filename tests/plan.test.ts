import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { seededRng, suggestFor, type Cand, type FillInput } from "@/lib/autofill";
import { weekSummary } from "@/lib/week-summary";

describe("weekSummary", () => {
  it("lists dinners, meats by count, and the cost", () => {
    expect(
      weekSummary({ dinners: 5, proteins: ["chicken", "beef", "chicken", "fish", "beef"], cost: { amount: 139.6, exact: true } })
    ).toBe("5 dinners · beef 2, chicken 2, fish 1 · about $140");
  });
  it("says 'up to' when the cost is only an estimate from the recipes", () => {
    expect(weekSummary({ dinners: 2, proteins: ["pork"], cost: { amount: 60, exact: false } })).toBe(
      "2 dinners · pork 1 · up to about $60"
    );
  });
  it("leaves out meats and cost when there are none", () => {
    expect(weekSummary({ dinners: 1, proteins: ["none"], cost: null })).toBe("1 dinner");
  });
  it("says so when nothing is planned", () => {
    expect(weekSummary({ dinners: 0, proteins: [], cost: null })).toBe("No dinners planned yet.");
  });
});

describe("suggestFor", () => {
  const weekStart = "2026-11-08";
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const mk = (i: number, over: Partial<Cand> = {}): Cand => ({
    id: "r" + i,
    name: "Recipe " + i,
    diet: "both",
    favorite: false,
    minutes: 30,
    protein: ["chicken", "beef", "fish", "pork"][i % 4],
    lastDay: null,
    ...over,
  });
  const input = (cands: Cand[], existing: FillInput["existing"] = {}): FillInput => ({
    days,
    existing,
    cands,
    mode: "home",
    weekStart,
  });

  it("gives four different recipes", () => {
    const got = suggestFor(input(Array.from({ length: 12 }, (_, i) => mk(i))), days[2], 4, seededRng("a"));
    expect(got).toHaveLength(4);
    expect(new Set(got.map((c) => c.id)).size).toBe(4);
  });
  it("gives fewer when there are not enough recipes, and none for no recipes", () => {
    expect(suggestFor(input([mk(0), mk(1)]), days[2], 4, seededRng("a"))).toHaveLength(2);
    expect(suggestFor(input([]), days[2], 4, seededRng("a"))).toEqual([]);
  });
  it("is the same every time for the same seed", () => {
    const i = input(Array.from({ length: 12 }, (_, k) => mk(k)));
    const a = suggestFor(i, days[2], 4, seededRng("x")).map((c) => c.id);
    expect(suggestFor(i, days[2], 4, seededRng("x")).map((c) => c.id)).toEqual(a);
  });
  it("skips a recipe already planned elsewhere in the week", () => {
    const i = input(Array.from({ length: 6 }, (_, k) => mk(k)), { [days[0]]: { id: "r0", protein: "chicken" } });
    expect(suggestFor(i, days[3], 5, seededRng("y")).map((c) => c.id)).not.toContain("r0");
  });
  it("keeps the same meat off the days beside it", () => {
    const i = input(Array.from({ length: 12 }, (_, k) => mk(k)), {
      [days[1]]: { id: "x1", protein: "chicken" },
      [days[3]]: { id: "x3", protein: "beef" },
    });
    for (const c of suggestFor(i, days[2], 4, seededRng("z"))) expect(["chicken", "beef"]).not.toContain(c.protein);
  });
});
