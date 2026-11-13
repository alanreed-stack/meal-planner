import { describe, expect, it } from "vitest";
import { carryOver } from "@/lib/cart-carry";
import { estimateCost, money } from "@/lib/recipe-cost";

describe("carryOver (rebuilding the shopping list)", () => {
  const sent = { picked: true, kroger_upc: "U1", sent_at: "T", sent_qty: 2, order_qty: 2 };
  it("starts a new item fresh", () => {
    expect(carryOver(undefined, "U1", 1)).toEqual({ picked: false, sent_at: null, sent_qty: 0 });
  });
  it("keeps 'in cart' when the need did not grow", () => {
    expect(carryOver(sent, "U1", 2)).toEqual({ picked: true, sent_at: "T", sent_qty: 2 });
    expect(carryOver(sent, "U1", 1)).toEqual({ picked: true, sent_at: "T", sent_qty: 2 });
  });
  it("clears 'in cart' when more is needed, and remembers how many were sent", () => {
    expect(carryOver(sent, "U1", 3)).toEqual({ picked: true, sent_at: null, sent_qty: 2 });
  });
  it("starts over for a different product", () => {
    expect(carryOver(sent, "U2", 2)).toEqual({ picked: true, sent_at: null, sent_qty: 0 });
  });
  it("counts rows sent before sent_qty existed as fully sent", () => {
    expect(carryOver({ ...sent, sent_qty: 0 }, "U1", 2)).toEqual({ picked: true, sent_at: "T", sent_qty: 2 });
  });
  it("keeps a pending 'more needed' count", () => {
    expect(carryOver({ ...sent, sent_at: null }, "U1", 4)).toEqual({ picked: true, sent_at: null, sent_qty: 2 });
  });
});

describe("estimateCost", () => {
  const matches = new Map([
    ["broccoli florets", { price: 6, size: "32 oz", description: "Broccoli" }],
    ["garlic", { price: 0.89, size: "1 ct", description: "Garlic" }],
    ["ground beef", { price: 5, size: "1 lb", description: "Ground beef" }],
  ]);
  const ings = [
    { name: "ground beef", qty: 2, unit: "lb", family_only: false },
    { name: "garlic", qty: 4, unit: "clove", family_only: false },
    { name: "olive oil", qty: 2, unit: "tbsp", family_only: false },
    { name: "white rice", qty: 3, unit: "cup", family_only: true },
  ];

  it("totals whole packages, skips staples, and lists what has no price", () => {
    const c = estimateCost(ings, 1, 4, matches, new Set(["olive oil"]));
    expect(c.total).toBeCloseTo(10.89); // 2 lb beef = 2 x 5.00, plus garlic 0.89
    expect(c.perServing).toBeCloseTo(10.89 / 4);
    expect(c.staples).toEqual(["olive oil"]);
    expect(c.missing).toEqual(["white rice"]);
  });
  it("scales the packages with the meat amount", () => {
    expect(estimateCost(ings, 2, 8, matches, new Set()).lines.find((l) => l.name === "ground beef")?.packs).toBe(4);
  });
  it("adds up the family-only part", () => {
    const priced = new Map(matches).set("white rice", { price: 3, size: "32 oz", description: "Rice" });
    expect(estimateCost(ings, 1, 4, priced, new Set()).familyOnlyTotal).toBeGreaterThan(0);
  });
  it("has no per-serving price when nothing is priced", () => {
    expect(estimateCost(ings, 1, 4, new Map(), new Set()).perServing).toBeNull();
  });
  it("formats money", () => {
    expect(money(3)).toBe("$3.00");
  });
});
