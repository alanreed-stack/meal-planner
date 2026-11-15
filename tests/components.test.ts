import { describe, expect, it } from "vitest";
import { componentToLine, expandIngredients, findComponent, parseComponentLine, toMap, type Component } from "@/lib/components";

const pico: Component = {
  id: "c1",
  name: "Pico de gallo",
  buy_as: "pico de gallo",
  buy_unit: "jar",
  ingredients: [
    { name: "tomatoes", qty: 4, unit: null, category: "produce" },
    { name: "white onion", qty: 0.5, unit: null, category: "produce" },
    { name: "cilantro", qty: 1, unit: "bunch", category: "produce" },
    { name: "lime juice", qty: 2, unit: "tbsp", category: "pantry" },
  ],
};
const map = toMap([pico]);
const plain = { name: "ground beef", qty: 2, unit: "lb", category: "meat" };

describe("expandIngredients", () => {
  it("passes ordinary rows through", () => {
    const out = expandIngredients([plain], map);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "ground beef", qty: 2, via: null });
  });
  it("makes from scratch by default", () => {
    const out = expandIngredients([{ name: "Pico de gallo", qty: 1, unit: null, category: "pantry", component_id: "c1" }], map);
    expect(out.map((o) => o.name)).toEqual(["tomatoes", "white onion", "cilantro", "lime juice"]);
    expect(out.every((o) => o.via === "Pico de gallo")).toBe(true);
  });
  it("scales by batches", () => {
    const out = expandIngredients([{ name: "Pico de gallo", qty: 2, unit: null, category: "pantry", component_id: "c1" }], map);
    expect(out.find((o) => o.name === "tomatoes")?.qty).toBe(8);
    expect(out.find((o) => o.name === "white onion")?.qty).toBe(1);
  });
  it("buys one ready-made item", () => {
    const out = expandIngredients(
      [{ name: "Pico de gallo", qty: 1, unit: null, category: "pantry", component_id: "c1", from_scratch: false }],
      map
    );
    expect(out).toEqual([
      { name: "pico de gallo", qty: 1, unit: "jar", category: "pantry", family_only: false, via: "Pico de gallo" },
    ]);
  });
  it("carries family-only to every expanded row", () => {
    const out = expandIngredients(
      [{ name: "Pico de gallo", qty: 1, unit: null, category: "pantry", component_id: "c1", family_only: true }],
      map
    );
    expect(out.every((o) => o.family_only)).toBe(true);
  });
  it("drops a component that no longer exists", () => {
    expect(expandIngredients([{ name: "x", qty: 1, unit: null, category: "pantry", component_id: "gone" }], map)).toEqual([]);
  });
  it("keeps unknown amounts unknown", () => {
    const c: Component = { ...pico, id: "c2", ingredients: [{ name: "salt", qty: null, unit: null, category: "pantry" }] };
    const out = expandIngredients([{ name: "x", qty: 3, unit: null, category: "pantry", component_id: "c2" }], toMap([c]));
    expect(out[0].qty).toBeNull();
  });
});

describe("component lines", () => {
  it("parses the forms", () => {
    expect(parseComponentLine("@Pico de gallo")).toEqual({ name: "Pico de gallo", batches: 1, from_scratch: true, family_only: false });
    expect(parseComponentLine("@2 Pico de gallo")).toMatchObject({ batches: 2, name: "Pico de gallo" });
    expect(parseComponentLine("@Pico de gallo (buy)")).toMatchObject({ from_scratch: false, name: "Pico de gallo" });
    expect(parseComponentLine("+@1/2 Pico de gallo (store bought)")).toEqual({
      name: "Pico de gallo", batches: 0.5, from_scratch: false, family_only: true,
    });
  });
  it("ignores ordinary lines and empty names", () => {
    expect(parseComponentLine("2 lb ground beef")).toBeNull();
    expect(parseComponentLine("@")).toBeNull();
  });
  it("round-trips", () => {
    for (const l of ["@Pico de gallo", "@2 Pico de gallo", "@Pico de gallo (buy)", "+@Pico de gallo"]) {
      const p = parseComponentLine(l)!;
      expect(componentToLine({ ...p })).toBe(l);
    }
  });
  it("finds by name loosely", () => {
    expect(findComponent("  pico  DE gallo ", [pico])?.id).toBe("c1");
    expect(findComponent("salsa", [pico])).toBeUndefined();
  });
});
