import { describe, expect, it } from "vitest";
import { cartSteps, needsLook, shareText, type CartState } from "@/lib/cart-steps";

const base: CartState = { listBuilt: false, hasStore: false, connected: false, toOrder: 0, unmatched: 0, unsent: 0 };
const at = (over: Partial<CartState>) => cartSteps({ ...base, ...over });

describe("cartSteps", () => {
  it("starts at building the list", () => {
    const r = at({});
    expect(r.next).toBe("list");
    expect(r.steps.map((s) => s.done)).toEqual([false, false, false, false, false]);
  });
  it("moves through store, connection, matching and sending in order", () => {
    expect(at({ listBuilt: true, toOrder: 10, unmatched: 10, unsent: 10 }).next).toBe("store");
    expect(at({ listBuilt: true, hasStore: true, toOrder: 10, unmatched: 10, unsent: 10 }).next).toBe("kroger");
    expect(at({ listBuilt: true, hasStore: true, connected: true, toOrder: 10, unmatched: 10, unsent: 10 }).next).toBe("matched");
    expect(at({ listBuilt: true, hasStore: true, connected: true, toOrder: 10, unmatched: 0, unsent: 10 }).next).toBe("sent");
  });
  it("is finished when everything is matched and in the cart", () => {
    const r = at({ listBuilt: true, hasStore: true, connected: true, toOrder: 10, unmatched: 0, unsent: 0 });
    expect(r.next).toBeNull();
    expect(r.steps.every((s) => s.done)).toBe(true);
  });
  it("goes back to matching when an item is left without a product", () => {
    expect(at({ listBuilt: true, hasStore: true, connected: true, toOrder: 10, unmatched: 2, unsent: 2 }).next).toBe("matched");
  });
  it("does not count an empty order as matched or sent", () => {
    const r = at({ listBuilt: true, hasStore: true, connected: true, toOrder: 0 });
    expect(r.steps.find((s) => s.key === "matched")?.done).toBe(false);
    expect(r.steps.find((s) => s.key === "sent")?.done).toBe(false);
  });
});

describe("needsLook", () => {
  const item = (over = {}) => ({ to_order: true, kroger_upc: "U", match_confidence: "ok", ...over });
  it("flags no match, low confidence and unclear quantity", () => {
    expect(needsLook(item({ kroger_upc: null }), false, true)).toBe(true);
    expect(needsLook(item({ match_confidence: "low" }), false, true)).toBe(true);
    expect(needsLook(item(), true, true)).toBe(true);
  });
  it("leaves good matches and unchecked or storeless rows alone", () => {
    expect(needsLook(item(), false, true)).toBe(false);
    expect(needsLook(item({ to_order: false, kroger_upc: null }), false, true)).toBe(false);
    expect(needsLook(item({ kroger_upc: null }), false, false)).toBe(false);
  });
});

describe("shareText", () => {
  it("groups by aisle and skips empty aisles", () => {
    expect(
      shareText("Shopping list · Nov 15 – Nov 21", [
        { category: "produce", lines: ["2 limes", "1 bunch cilantro"] },
        { category: "dairy", lines: [] },
        { category: "meat", lines: ["2 lb ground beef"] },
      ])
    ).toBe("Shopping list · Nov 15 – Nov 21\n\nPRODUCE\n- 2 limes\n- 1 bunch cilantro\n\nMEAT\n- 2 lb ground beef");
  });
  it("is just the title for an empty list", () => {
    expect(shareText("List", [])).toBe("List");
  });
});
