import { describe, expect, it } from "vitest";
import { mainNoun, pickProduct, scoreProduct, splitOptions, tokens } from "@/lib/match";
import type { Product } from "@/lib/kroger";

const product = (description: string, over: Partial<Product> = {}): Product => ({
  upc: description.toLowerCase().replace(/\W+/g, "-"),
  productId: "p",
  description,
  brand: "Kroger",
  size: "1 lb",
  price: 4.99,
  categories: [],
  image: null,
  aisle: null,
  ...over,
});

describe("tokens and options", () => {
  it("lowercases and singularizes", () => {
    expect(tokens("Small Tortillas")).toEqual(["small", "tortilla"]);
    expect(tokens("Tomatoes")).toEqual(["tomato"]);
    expect(tokens("Berries")).toEqual(["berry"]);
  });
  it("splits 'or' options and drops notes", () => {
    expect(splitOptions("ziti or penne (dry)")).toEqual(["ziti", "penne"]);
    expect(splitOptions("ground beef")).toEqual(["ground beef"]);
  });
  it("finds the noun that identifies the thing", () => {
    expect(mainNoun("small tortillas")).toBe("tortilla");
    expect(mainNoun("ground beef")).toBe("beef");
  });
});

describe("scoreProduct", () => {
  it("prefers the real thing over a snack with the same word", () => {
    const tortillas = scoreProduct("flour tortillas", "bakery", product("Flour Tortillas 10 ct", { categories: ["Bakery"] }), 0);
    const chips = scoreProduct("flour tortillas", "bakery", product("Tortilla Chips", { brand: "Tostitos", categories: ["Snacks"] }), 0);
    expect(tortillas.score).toBeGreaterThan(chips.score);
    expect(tortillas.nounHit).toBe(true);
  });
  it("lets chips win when chips are what was asked for", () => {
    const chips = scoreProduct("tortilla chips", "pantry", product("Tortilla Chips", { categories: ["Snacks"] }), 0);
    expect(chips.score).toBeGreaterThan(3);
  });
  it("ranks earlier search results slightly higher", () => {
    const a = scoreProduct("beef", "meat", product("Ground Beef"), 0);
    const b = scoreProduct("beef", "meat", product("Ground Beef"), 5);
    expect(a.score).toBeGreaterThan(b.score);
  });
});

describe("pickProduct", () => {
  it("takes a confident match", async () => {
    const pick = await pickProduct("chicken breast", "meat", async () => [
      product("Boneless Skinless Chicken Breast", { categories: ["Meat & Seafood"] }),
    ]);
    expect(pick?.confidence).toBe("ok");
    expect(pick?.product.description).toContain("Chicken Breast");
  });

  it("marks a weak match as low confidence", async () => {
    const pick = await pickProduct("chicken breast", "meat", async () => [product("Paper Towels")]);
    expect(pick?.confidence).toBe("low");
  });

  it("returns null when nothing comes back", async () => {
    expect(await pickProduct("unobtainium", "pantry", async () => [])).toBeNull();
  });

  it("tries the next 'or' option when the first finds nothing", async () => {
    const asked: string[] = [];
    const pick = await pickProduct("ziti or penne", "pantry", async (term) => {
      asked.push(term);
      return term === "penne" ? [product("Penne Pasta", { size: "16 oz" })] : [];
    });
    expect(asked).toEqual(["ziti", "penne"]);
    expect(pick?.product.description).toBe("Penne Pasta");
  });

  it("keeps going when a search fails", async () => {
    const pick = await pickProduct("ziti or penne", "pantry", async (term) => {
      if (term === "ziti") throw new Error("network");
      return [product("Penne Pasta")];
    });
    expect(pick?.product.description).toBe("Penne Pasta");
  });
});
