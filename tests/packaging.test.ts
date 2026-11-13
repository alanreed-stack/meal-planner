import { describe, expect, it } from "vitest";
import { packagesNeeded, parseSize } from "@/lib/packaging";

const need = (qty: number | null, unit: string | null, name: string) => ({ qty, unit, name });

describe("parseSize", () => {
  it("reads weights, volumes and counts", () => {
    expect(parseSize("16 oz")).toEqual({ kind: "weight", amount: 16 });
    expect(parseSize("1 lb")).toEqual({ kind: "weight", amount: 16 });
    expect(parseSize("32 fl oz")).toEqual({ kind: "volume", amount: 32 });
    expect(parseSize("1 gal")).toEqual({ kind: "volume", amount: 128 });
    expect(parseSize("12 ct")).toEqual({ kind: "count", amount: 12 });
  });
  it("gives null when there is nothing to read", () => {
    expect(parseSize("big bag")).toBeNull();
    expect(parseSize(null)).toBeNull();
    expect(parseSize("")).toBeNull();
  });
});

describe("packagesNeeded", () => {
  it("rounds weight up to whole packages", () => {
    expect(packagesNeeded(need(2, "lb", "ground beef"), "1 lb").packs).toBe(2);
    expect(packagesNeeded(need(1.5, "lb", "ground beef"), "1 lb").packs).toBe(2);
    expect(packagesNeeded(need(32, "oz", "ground beef"), "16 oz").packs).toBe(2);
  });
  it("does not buy another package for a rounding sliver", () => {
    expect(packagesNeeded(need(16.3, "oz", "cheese"), "16 oz").packs).toBe(1);
  });
  it("buys what the recipe already counts in packages", () => {
    expect(packagesNeeded(need(2, "jar", "marinara"), "24 oz").packs).toBe(2);
    expect(packagesNeeded(need(1.2, "can", "black beans"), null).packs).toBe(2);
  });
  it("converts cups of cheese to ounces", () => {
    const two = packagesNeeded(need(2, "cup", "shredded cheddar"), "8 oz");
    expect(two.packs).toBe(1);
    expect(two.estimated).toBe(true);
    expect(packagesNeeded(need(3, "cup", "shredded cheddar"), "8 oz").packs).toBe(2);
  });
  it("covers a spoonful from a bottle with one", () => {
    expect(packagesNeeded(need(2, "tbsp", "sriracha"), "17 oz").packs).toBe(1);
    expect(packagesNeeded(need(2, "tbsp", "olive oil"), "16.9 fl oz").packs).toBe(1);
  });
  it("estimates pieces from their weight", () => {
    const r = packagesNeeded(need(4, "piece", "chicken breasts"), "1 lb");
    expect(r.packs).toBe(2);
    expect(r.estimated).toBe(true);
  });
  it("estimates garlic cloves from a head", () => {
    expect(packagesNeeded(need(4, "clove", "garlic"), "1 ct").packs).toBe(1);
  });
  it("flags what it cannot work out and buys one", () => {
    const r = packagesNeeded(need(2, "lb", "ground beef"), null);
    expect(r.packs).toBe(1);
    expect(r.flag).toBe(true);
    expect(packagesNeeded(need(12, "cup", "broccoli florets"), "32 oz").flag).toBe(true);
  });
  it("buys one when there is no amount", () => {
    const r = packagesNeeded(need(null, null, "salt"), "26 oz");
    expect(r.packs).toBe(1);
    expect(r.flag).toBe(false);
  });
  it("never goes over 50", () => {
    expect(packagesNeeded(need(500, "lb", "ground beef"), "1 lb").packs).toBe(50);
  });
});
