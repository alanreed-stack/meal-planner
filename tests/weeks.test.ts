import { describe, expect, it } from "vitest";
import { addDays, isPlanningDay, weekStartOf, weekRelation } from "@/lib/dates";
import { groceryFocus, shouldPlanNextWeek } from "@/lib/home-week";

const thisWeekStart = "2026-11-08"; // a Sunday

describe("weekRelation", () => {
  it("is null for the current week", () => {
    expect(weekRelation(thisWeekStart, thisWeekStart)).toBeNull();
  });
  it("names the neighbouring weeks", () => {
    expect(weekRelation(addDays(thisWeekStart, 7), thisWeekStart)).toBe("Next week");
    expect(weekRelation(addDays(thisWeekStart, -7), thisWeekStart)).toBe("Last week");
  });
  it("counts the rest", () => {
    expect(weekRelation(addDays(thisWeekStart, 21), thisWeekStart)).toBe("In 3 weeks");
    expect(weekRelation(addDays(thisWeekStart, -14), thisWeekStart)).toBe("2 weeks ago");
  });
  it("works across a year end", () => {
    expect(weekRelation("2027-01-03", "2026-12-27")).toBe("Next week");
  });
});

describe("weekStartOf (weeks run Sunday through Saturday)", () => {
  it("returns the Sunday that starts the week", () => {
    expect(weekStartOf("2026-11-08")).toBe("2026-11-08"); // Sunday is the first day
    expect(weekStartOf("2026-11-09")).toBe("2026-11-08"); // Monday
    expect(weekStartOf("2026-11-14")).toBe("2026-11-08"); // Saturday is the last day
    expect(weekStartOf("2026-11-15")).toBe("2026-11-15"); // the next Sunday starts a new week
  });
  it("works across month and year ends", () => {
    expect(weekStartOf("2026-12-31")).toBe("2026-12-27");
    expect(weekStartOf("2027-01-01")).toBe("2026-12-27");
    expect(weekStartOf("2026-03-01")).toBe("2026-03-01");
  });
  it("always lands on a Sunday and covers exactly seven days", () => {
    for (let i = 0; i < 60; i++) {
      const d = addDays("2026-10-01", i);
      const start = weekStartOf(d);
      expect(new Date(start + "T00:00:00Z").getUTCDay()).toBe(0);
      expect(d >= start && d <= addDays(start, 6)).toBe(true);
    }
  });
});

describe("shouldPlanNextWeek", () => {
  it("nudges on the last two days of the week", () => {
    expect(isPlanningDay("2026-11-12")).toBe(false); // Thursday
    expect(isPlanningDay("2026-11-13")).toBe(true); // Friday
    expect(isPlanningDay("2026-11-14")).toBe(true); // Saturday
    expect(isPlanningDay("2026-11-15")).toBe(false); // Sunday, the new week has started
    expect(shouldPlanNextWeek("2026-11-12", 0)).toBe(false);
    expect(shouldPlanNextWeek("2026-11-13", 0)).toBe(true);
    expect(shouldPlanNextWeek("2026-11-14", 2)).toBe(true);
    expect(shouldPlanNextWeek("2026-11-15", 0)).toBe(false);
  });
  it("stops once three dinners are planned", () => {
    expect(shouldPlanNextWeek("2026-11-14", 3)).toBe(false);
    expect(shouldPlanNextWeek("2026-11-14", 6)).toBe(false);
  });
});

describe("groceryFocus", () => {
  const w = (weekStart: string, toOrder: number, inCart: number) => ({ weekStart, toOrder, inCart });
  it("shows this week while it still has something to send", () => {
    expect(groceryFocus([w("a", 10, 4), w("b", 12, 0)]).weekStart).toBe("a");
  });
  it("moves on to next week once this week is all in the cart", () => {
    expect(groceryFocus([w("a", 10, 10), w("b", 12, 0)]).weekStart).toBe("b");
  });
  it("shows the finished list when nothing is left to send anywhere", () => {
    expect(groceryFocus([w("a", 10, 10), w("b", 0, 0)]).weekStart).toBe("a");
    expect(groceryFocus([w("a", 0, 0), w("b", 5, 5)]).weekStart).toBe("b");
  });
  it("falls back to this week when there are no lists", () => {
    expect(groceryFocus([w("a", 0, 0), w("b", 0, 0)]).weekStart).toBe("a");
  });
});

import { describeBuild } from "@/lib/build-summary";

describe("describeBuild (the message after building a list)", () => {
  const r = (over: Partial<Parameters<typeof describeBuild>[0]> = {}) =>
    describeBuild({ added: 0, removed: 0, changed: 0, matched: 0, empty: false, ...over });
  it("says what was added and removed", () => {
    expect(r({ added: 6, removed: 2 })).toBe("Added 6 items, removed 2.");
    expect(r({ added: 1 })).toBe("Added 1 item.");
  });
  it("mentions changed amounts and new Kroger matches", () => {
    expect(r({ changed: 3, matched: 5 })).toBe("3 amounts changed. Found Kroger products for 5.");
    expect(r({ changed: 1 })).toBe("1 amount changed.");
  });
  it("says so when nothing changed", () => {
    expect(r()).toBe("No changes, the list was already up to date.");
  });
  it("explains an empty plan", () => {
    expect(r({ empty: true })).toBe("Nothing to list yet. Plan some recipes first.");
  });
});

import { gettingStarted } from "@/lib/getting-started";
import { headsUp, isLongCook } from "@/lib/heads-up";
import { quickPicks, weekStatus, type QuickCand } from "@/lib/home-week";

describe("gettingStarted", () => {
  const s = { recipes: 0, plannedDinners: 0, hasStore: false, krogerConnected: false, staples: 0 };
  it("starts with nothing done", () => {
    const r = gettingStarted(s);
    expect(r.doneCount).toBe(0);
    expect(r.allDone).toBe(false);
    expect(r.items).toHaveLength(5);
  });
  it("checks each line off by itself", () => {
    const r = gettingStarted({ ...s, recipes: 70, plannedDinners: 3, hasStore: true });
    expect(r.items.filter((i) => i.done).map((i) => i.key)).toEqual(["recipes", "plan", "store"]);
    expect(r.allDone).toBe(false);
  });
  it("is finished when all five are done", () => {
    expect(gettingStarted({ recipes: 1, plannedDinners: 1, hasStore: true, krogerConnected: true, staples: 1 }).allDone).toBe(true);
  });
});

describe("weekStatus", () => {
  it("reads like a sentence of links", () => {
    expect(weekStatus({ dinners: 5, listBuilt: true, toOrder: 24, inCart: 18 })).toEqual([
      { text: "5 of 7 dinners planned", to: "plan" },
      { text: "list built", to: "shopping" },
      { text: "18 of 24 in cart", to: "shopping" },
    ]);
  });
  it("leaves out the cart when there is nothing to order", () => {
    expect(weekStatus({ dinners: 0, listBuilt: false, toOrder: 0, inCart: 0 }).map((p) => p.text)).toEqual([
      "0 of 7 dinners planned",
      "no list yet",
    ]);
  });
});

describe("headsUp", () => {
  const base = { name: "Pot Roast", prepMinutes: 5, cookMinutes: 480, tags: [] as string[], protein: "beef" };
  it("gives a start-by time for a long cook", () => {
    expect(isLongCook(base)).toBe(true);
    expect(headsUp(base, "18:00:00", false)).toEqual(["Tomorrow: start Pot Roast by 9:55 AM."]);
  });
  it("treats a slow-cooker tag as a long cook even when the time is short", () => {
    expect(isLongCook({ cookMinutes: 30, tags: ["slow-cooker"] })).toBe(true);
  });
  it("says nothing for a quick meal", () => {
    expect(headsUp({ ...base, cookMinutes: 25, prepMinutes: 10 }, "18:00:00", false)).toEqual([]);
  });
  it("adds the thaw reminder only when it is turned on and there is meat", () => {
    const quick = { ...base, cookMinutes: 25, prepMinutes: 10, protein: "chicken" };
    expect(headsUp(quick, "18:00:00", true)).toEqual(["Tomorrow's chicken: if it is frozen, move it to the fridge tonight."]);
    expect(headsUp(quick, "18:00:00", false)).toEqual([]);
    expect(headsUp({ ...quick, protein: "none" }, "18:00:00", true)).toEqual([]);
  });
  it("can give both at once", () => {
    expect(headsUp(base, "18:00:00", true)).toHaveLength(2);
  });
});

describe("quickPicks", () => {
  const c = (id: string, over: Partial<QuickCand> = {}): QuickCand => ({
    id, name: id, diet: "both", favorite: false, minutes: 25, lastDay: null, ...over,
  });
  const today = "2026-11-16";
  it("prefers favorites, and only quick ones", () => {
    const picks = quickPicks([c("slow", { minutes: 90, favorite: true }), c("a", { favorite: true }), c("b"), c("c", { favorite: true })], "home", today);
    expect(picks.map((p) => p.id)).not.toContain("slow");
    expect(picks.slice(0, 2).every((p) => p.favorite)).toBe(true);
    expect(picks).toHaveLength(3);
  });
  it("skips what was made in the last two weeks", () => {
    const picks = quickPicks([c("recent", { favorite: true, lastDay: "2026-11-10" }), c("old", { lastDay: "2026-10-01" })], "home", today);
    expect(picks.map((p) => p.id)).toEqual(["old"]);
  });
  it("respects home and travel weeks", () => {
    const cands = [c("fam", { diet: "family" }), c("keto", { diet: "keto" }), c("both")];
    expect(quickPicks(cands, "home", today).map((p) => p.id).sort()).toEqual(["both", "keto"]);
    expect(quickPicks(cands, "travel", today).map((p) => p.id).sort()).toEqual(["both", "fam"]);
  });
  it("is steady within a day and varies from day to day", () => {
    const cands = Array.from({ length: 12 }, (_, i) => c("r" + i));
    const a = quickPicks(cands, "home", today).map((p) => p.id);
    expect(quickPicks(cands, "home", today).map((p) => p.id)).toEqual(a);
    const days = ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"].map((d) => quickPicks(cands, "home", d).map((p) => p.id).join());
    expect(new Set([a.join(), ...days]).size).toBeGreaterThan(1);
  });
});
