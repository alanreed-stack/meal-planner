import { describe, expect, it } from "vitest";
import { niceQty, proteinLbs, scaleFactor } from "@/lib/scale";

const ing = (name: string, qty: number | null, unit: string | null, category = "meat") => ({ name, qty, unit, category });

describe("proteinLbs", () => {
  it("adds up the meat that is weighed in pounds", () => {
    expect(proteinLbs([ing("ground beef", 1.5, "lb"), ing("bacon", 0.5, "lb"), ing("garlic", 4, "clove", "produce")])).toBe(2);
  });
  it("estimates meat sold by the piece", () => {
    expect(proteinLbs([ing("bone-in chicken thighs", 8, "piece")])).toBeCloseTo(3.2);
  });
  it("is null when there is no weighable meat", () => {
    expect(proteinLbs([ing("zucchini", 3, "piece", "produce")])).toBeNull();
    expect(proteinLbs([ing("mystery meat", 3, "piece")])).toBeNull();
    expect(proteinLbs([ing("ground beef", null, "lb")])).toBeNull();
  });
});

describe("scaleFactor", () => {
  it("scales to the chosen pounds", () => {
    expect(scaleFactor([ing("ground beef", 1.5, "lb")], 3)).toBe(2);
    expect(scaleFactor([ing("ground beef", 2, "lb")], 1)).toBe(0.5);
  });
  it("leaves recipes with no weighed meat alone", () => {
    expect(scaleFactor([ing("zucchini", 3, "piece", "produce")], 5)).toBe(1);
  });
});

describe("niceQty", () => {
  it("rounds counted things up so nobody runs short", () => {
    expect(niceQty(1.2, "clove")).toBe(2);
    expect(niceQty(2.04, "clove")).toBe(2); // a hair over is not worth another one
    expect(niceQty(0.2, "piece")).toBe(1);
  });
  it("rounds packaged things to the nearest whole package", () => {
    expect(niceQty(1.33, "box")).toBe(1);
    expect(niceQty(1.6, "box")).toBe(2);
    expect(niceQty(0.2, "can")).toBe(1);
  });
  it("keeps two decimals for everything else", () => {
    expect(niceQty(1.337, "cup")).toBe(1.34);
    expect(niceQty(3, "lb")).toBe(3);
  });
});
