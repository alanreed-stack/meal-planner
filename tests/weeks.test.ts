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
