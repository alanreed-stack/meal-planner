import { describe, expect, it } from "vitest";
import { addDays, isWeekendDay, mondayOf, weekRelation } from "@/lib/dates";
import { groceryFocus, shouldPlanNextWeek } from "@/lib/home-week";

const thisMonday = "2026-11-09";

describe("weekRelation", () => {
  it("is null for the current week", () => {
    expect(weekRelation(thisMonday, thisMonday)).toBeNull();
  });
  it("names the neighbouring weeks", () => {
    expect(weekRelation(addDays(thisMonday, 7), thisMonday)).toBe("Next week");
    expect(weekRelation(addDays(thisMonday, -7), thisMonday)).toBe("Last week");
  });
  it("counts the rest", () => {
    expect(weekRelation(addDays(thisMonday, 21), thisMonday)).toBe("In 3 weeks");
    expect(weekRelation(addDays(thisMonday, -14), thisMonday)).toBe("2 weeks ago");
  });
  it("works across a year end", () => {
    expect(weekRelation("2027-01-04", "2026-12-28")).toBe("Next week");
  });
});

describe("shouldPlanNextWeek", () => {
  it("only nudges from Saturday on", () => {
    expect(isWeekendDay("2026-11-13")).toBe(false); // Friday
    expect(isWeekendDay("2026-11-14")).toBe(true); // Saturday
    expect(isWeekendDay("2026-11-15")).toBe(true); // Sunday
    expect(shouldPlanNextWeek("2026-11-13", 0)).toBe(false);
    expect(shouldPlanNextWeek("2026-11-14", 0)).toBe(true);
    expect(shouldPlanNextWeek("2026-11-15", 2)).toBe(true);
  });
  it("stops once three dinners are planned", () => {
    expect(shouldPlanNextWeek("2026-11-14", 3)).toBe(false);
    expect(shouldPlanNextWeek("2026-11-14", 6)).toBe(false);
  });
  it("treats Sunday as part of the week that is ending", () => {
    // Sunday 15th belongs to the week of Monday the 9th, so "next week" is the 16th.
    expect(addDays(mondayOf("2026-11-15"), 7)).toBe("2026-11-16");
  });
});

describe("groceryFocus", () => {
  const w = (monday: string, toOrder: number, inCart: number) => ({ monday, toOrder, inCart });
  it("shows this week while it still has something to send", () => {
    expect(groceryFocus([w("a", 10, 4), w("b", 12, 0)]).monday).toBe("a");
  });
  it("moves on to next week once this week is all in the cart", () => {
    expect(groceryFocus([w("a", 10, 10), w("b", 12, 0)]).monday).toBe("b");
  });
  it("shows the finished list when nothing is left to send anywhere", () => {
    expect(groceryFocus([w("a", 10, 10), w("b", 0, 0)]).monday).toBe("a");
    expect(groceryFocus([w("a", 0, 0), w("b", 5, 5)]).monday).toBe("b");
  });
  it("falls back to this week when there are no lists", () => {
    expect(groceryFocus([w("a", 0, 0), w("b", 0, 0)]).monday).toBe("a");
  });
});
