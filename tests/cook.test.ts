import { describe, expect, it } from "vitest";
import { cookKey, findTimers, formatClock, formatDuration, isOldCookKey, readCook } from "@/lib/cook";

const mins = (step: string) => findTimers(step).map((t) => t.label);

describe("findTimers", () => {
  it("finds minutes and hours", () => {
    expect(mins("Simmer 20 minutes, stirring now and then.")).toEqual(["20 min"]);
    expect(mins("Bake for 1 hour.")).toEqual(["1 hr"]);
    expect(mins("Cook 45 min.")).toEqual(["45 min"]);
    expect(mins("Roast 25 mins until 165F.")).toEqual(["25 min"]);
  });
  it("finds seconds", () => {
    expect(mins("Add the garlic for 30 seconds.")).toEqual(["30 sec"]);
    expect(mins("Add garlic/ginger 30 sec, then the chicken.")).toEqual(["30 sec"]);
  });
  it("uses the longer end of a range", () => {
    expect(findTimers("Brown the beef 6-7 minutes.")[0]).toEqual({ seconds: 420, label: "7 min" });
    expect(findTimers("Cook 6 to 7 minutes.")[0].seconds).toBe(420);
    expect(findTimers("Rest 2–3 minutes.")[0].seconds).toBe(180);
  });
  it("reads fractions and decimals", () => {
    expect(findTimers("Cook 1 1/2 hours.")[0].seconds).toBe(5400);
    expect(findTimers("Simmer 1/2 hour.")[0].seconds).toBe(1800);
    expect(findTimers("Cook ½ hour.")[0].seconds).toBe(1800);
    expect(findTimers("High 3.5 hours.")[0].seconds).toBe(12600);
  });
  it("gives a button for each time when a step has two", () => {
    expect(mins("Slow cooker on Low 6 hours or High 3.5 hours.")).toEqual(["6 hr", "3 hr 30 min"]);
    expect(mins("Sear 2 minutes. Flip, 2 minutes more.")).toEqual(["2 min"]); // the same time once
  });
  it("ignores quantities, temperatures and tiny or huge times", () => {
    expect(mins("Add 2 tbsp oil and 4 cups broth.")).toEqual([]);
    expect(mins("Heat the oven to 425F.")).toEqual([]);
    expect(mins("Wait 3 seconds.")).toEqual([]);
    expect(mins("Marinate 48 hours.")).toEqual([]);
    expect(mins("Serve.")).toEqual([]);
  });
  it("finds the times in real recipe steps", () => {
    expect(mins("Add the tomatoes and chili seasoning and simmer 15 minutes.")).toEqual(["15 min"]);
    expect(mins("Roast 30 to 35 minutes until chicken hits 175F and skin is crisp.")).toEqual(["35 min"]);
    expect(mins("Cook on Low for 8 hours or High for 4, then shred.")).toEqual(["8 hr"]);
  });
});

describe("formatDuration and formatClock", () => {
  it("says durations the way people do", () => {
    expect(formatDuration(30)).toBe("30 sec");
    expect(formatDuration(1200)).toBe("20 min");
    expect(formatDuration(3600)).toBe("1 hr");
    expect(formatDuration(5400)).toBe("1 hr 30 min");
  });
  it("shows a countdown", () => {
    expect(formatClock(1205)).toBe("20:05");
    expect(formatClock(59.2)).toBe("1:00");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("0:00");
  });
});

describe("saved progress", () => {
  it("starts empty when nothing was saved", () => {
    expect(readCook(null, 3, 2)).toEqual({ done: [false, false, false], gathered: [false, false], timers: [], rated: false });
  });
  it("brings back checked steps, ingredients and timers", () => {
    const raw = JSON.stringify({
      done: [true, true, false],
      gathered: [true, false],
      timers: [{ id: "t1", step: 1, label: "20 min", endsAt: 1000 }],
      rated: true,
    });
    const r = readCook(raw, 3, 2);
    expect(r.done).toEqual([true, true, false]);
    expect(r.gathered).toEqual([true, false]);
    expect(r.timers).toHaveLength(1);
    expect(r.rated).toBe(true);
  });
  it("copes with a recipe that gained or lost steps", () => {
    const raw = JSON.stringify({ done: [true, true, true], gathered: [] });
    expect(readCook(raw, 2, 1).done).toEqual([true, true]);
    expect(readCook(raw, 5, 1).done).toEqual([true, true, true, false, false]);
  });
  it("copes with bad data", () => {
    expect(readCook("not json", 2, 1).done).toEqual([false, false]);
    expect(readCook("null", 2, 1).done).toEqual([false, false]);
    expect(readCook(JSON.stringify({ done: "yes", timers: [{ nope: 1 }, 5] }), 2, 1).timers).toEqual([]);
  });
  it("keys by recipe and day, and finds old days to clear", () => {
    expect(cookKey("abc", "2026-11-14")).toBe("cook:v1:abc:2026-11-14");
    expect(isOldCookKey("cook:v1:abc:2026-11-13", "2026-11-14")).toBe(true);
    expect(isOldCookKey("cook:v1:abc:2026-11-14", "2026-11-14")).toBe(false);
    expect(isOldCookKey("something:else", "2026-11-14")).toBe(false);
  });
});
