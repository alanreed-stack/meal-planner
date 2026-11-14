import { describe, expect, it } from "vitest";
import { parseRecipeText, looksLikeIngredient } from "@/lib/recipe-text";
import { matchesQuery, searchText } from "@/lib/recipe-search";
import { fitWithin } from "@/lib/resize-image";
import { costIfKnown, estimateCost } from "@/lib/recipe-cost";

describe("parseRecipeText", () => {
  it("reads a recipe with headings", () => {
    const d = parseRecipeText(`Garlic Butter Shrimp
Quick and easy weeknight dinner.
Serves 4
Prep time: 10 minutes
Cook time: 8 minutes

Ingredients
- 1 1/2 lb large shrimp
- 4 cloves garlic, minced
- 3 tbsp butter

Instructions
1. Melt the butter in a large pan.
2. Add garlic and cook 30 seconds.
3. Add shrimp and cook 3 minutes per side.`);
    expect(d.name).toBe("Garlic Butter Shrimp");
    expect(d.description).toBe("Quick and easy weeknight dinner.");
    expect(d.servings).toBe(4);
    expect(d.prep_minutes).toBe(10);
    expect(d.cook_minutes).toBe(8);
    expect(d.ingredients.split("\n")).toEqual(["1 1/2 lb large shrimp", "4 cloves garlic, minced", "3 tbsp butter"]);
    expect(d.steps.split("\n")).toEqual([
      "Melt the butter in a large pan.",
      "Add garlic and cook 30 seconds.",
      "Add shrimp and cook 3 minutes per side.",
    ]);
  });

  it("reads a recipe with no headings by what each line looks like", () => {
    const d = parseRecipeText(`Taco Night
2 lb ground beef
1 onion, diced
2 tbsp chili powder
Brown the beef with the onion until cooked through.
Add the spices and a splash of water, simmer 5 minutes.`);
    expect(d.name).toBe("Taco Night");
    expect(d.ingredients.split("\n")).toEqual(["2 lb ground beef", "1 onion, diced", "2 tbsp chili powder"]);
    expect(d.steps.split("\n")).toHaveLength(2);
  });

  it("does not mistake a numbered step for an ingredient", () => {
    const d = parseRecipeText(`Sheet pan chicken
4 chicken thighs
1. Preheat the oven to 425F.
2. Roast 25 minutes.`);
    expect(d.ingredients).toBe("4 chicken thighs");
    expect(d.steps.split("\n")).toEqual(["Preheat the oven to 425F.", "Roast 25 minutes."]);
  });

  it("understands other headings, unicode fractions and 'makes'", () => {
    const d = parseRecipeText(`Blueberry Muffins
Makes 12 muffins
Prep: 15 min

What you'll need:
½ cup sugar
2 cups flour

Directions:
Mix everything.
Bake 20 minutes.

Tips:
Do not overmix.`);
    expect(d.servings).toBe(12);
    expect(d.prep_minutes).toBe(15);
    expect(d.ingredients.split("\n")).toEqual(["½ cup sugar", "2 cups flour"]);
    expect(d.steps.split("\n")).toEqual(["Mix everything.", "Bake 20 minutes."]);
  });

  it("converts hours to minutes", () => {
    expect(parseRecipeText("Roast\nCook time: 2 hours\nIngredients\n1 lb pork").cook_minutes).toBe(120);
  });

  it("copes with empty text", () => {
    const d = parseRecipeText("   \n\n");
    expect(d.name).toBe("");
    expect(d.ingredients).toBe("");
    expect(d.steps).toBe("");
  });
});

describe("looksLikeIngredient", () => {
  it("accepts amounts and rejects sentences and steps", () => {
    expect(looksLikeIngredient("2 lb ground beef")).toBe(true);
    expect(looksLikeIngredient("1 1/2 cups flour")).toBe(true);
    expect(looksLikeIngredient("- ½ tsp salt")).toBe(true);
    expect(looksLikeIngredient("Brown the beef until cooked through.")).toBe(false);
    expect(looksLikeIngredient("3. Add the sauce and stir.")).toBe(false);
    expect(looksLikeIngredient("")).toBe(false);
  });
});

describe("recipe search", () => {
  const text = searchText(
    { name: "Turkey Chili", tags: ["slow-cooker", "quick"], description: "Cozy." },
    ["ground turkey", "kidney beans", "diced tomatoes"]
  );
  it("finds by name, tag and ingredient", () => {
    expect(matchesQuery(text, "chili")).toBe(true);
    expect(matchesQuery(text, "quick")).toBe(true);
    expect(matchesQuery(text, "kidney")).toBe(true);
  });
  it("finds as you type, from the first few letters", () => {
    expect(matchesQuery(text, "turk")).toBe(true);
    expect(matchesQuery(text, "tom")).toBe(true);
  });
  it("needs every word", () => {
    expect(matchesQuery(text, "turkey chili")).toBe(true);
    expect(matchesQuery(text, "turkey salmon")).toBe(false);
  });
  it("ignores case, dashes and extra spaces", () => {
    expect(matchesQuery(text, "  SLOW cooker ")).toBe(true);
    expect(matchesQuery(text, "slow-cooker")).toBe(true);
  });
  it("shows everything for an empty search", () => {
    expect(matchesQuery(text, "")).toBe(true);
    expect(matchesQuery(text, "   ")).toBe(true);
  });
});

describe("fitWithin", () => {
  it("scales the long side down to the limit", () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 });
  });
  it("never makes a small picture bigger", () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1200, 1200, 1200)).toEqual({ width: 1200, height: 1200 });
  });
});

describe("costIfKnown", () => {
  const matches = new Map([
    ["a", { price: 5, size: "1 lb", description: "A" }],
    ["b", { price: 2, size: "1 lb", description: "B" }],
  ]);
  const ing = (name: string) => ({ name, qty: 1, unit: "lb", family_only: false });
  it("gives the cost when most ingredients are priced", () => {
    expect(costIfKnown(estimateCost([ing("a"), ing("b")], 1, 4, matches, new Set()))).toBe(7);
  });
  it("gives nothing when too few are priced", () => {
    expect(costIfKnown(estimateCost([ing("a"), ing("x"), ing("y"), ing("z")], 1, 4, matches, new Set()))).toBeNull();
    expect(costIfKnown(estimateCost([ing("x")], 1, 4, matches, new Set()))).toBeNull();
  });
  it("ignores pantry staples when judging", () => {
    expect(costIfKnown(estimateCost([ing("a"), ing("salt")], 1, 4, matches, new Set(["salt"])))).toBe(5);
  });
});
