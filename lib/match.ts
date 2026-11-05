// Picks the best Kroger product for an ingredient, and says how sure we are.
import type { Product } from "./kroger";

const STOP = new Set([
  "fresh", "frozen", "canned", "large", "small", "medium", "jumbo", "whole", "sliced", "diced", "chopped",
  "shredded", "boneless", "skinless", "bone-in", "dried", "raw", "plain", "extra", "virgin", "organic",
  "of", "and", "the", "a", "or", "pack", "packet", "bag", "box", "can", "jar", "cooked", "ground", "crowns", "style",
]);

function singular(w: string): string {
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("ss") || w.endsWith("us")) return w;
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[®™©]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

/** "ground beef or Italian sausage" -> ["ground beef", "Italian sausage"] */
export function splitOptions(name: string): string[] {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+or\s+/i)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** The words that identify the thing: the last non-descriptor word, e.g. "tortillas" in "small tortillas". */
export function mainNoun(option: string): string | null {
  const t = tokens(option).filter((w) => !STOP.has(w));
  return t.length ? t[t.length - 1] : null;
}

/** What Kroger calls the aisle, by our list category. Pantry is too varied to filter on. */
const EXPECTED_CATEGORY: Record<string, RegExp> = {
  produce: /produce|fruit|vegetable/,
  meat: /meat|seafood|poultry|beef|pork|chicken/,
  dairy: /dairy|cheese|egg/,
  bakery: /bakery|bread|tortilla|deli/,
  frozen: /frozen/,
};

const BAD_WORDS = new Set([
  "chips", "chip", "crisps", "crisp", "snack", "stacks", "puffs", "bites", "jerky", "cookie", "cracker",
  "candy", "cereal", "soda", "treat", "kit", "gummy", "bar", "popcorn", "pretzel",
]);
const BAD_CATEGORY = /snack|candy|cookie|cracker|cereal|beverage|pet/;

export type Scored = { product: Product; score: number; nounHit: boolean };

export function scoreProduct(
  option: string,
  listCategory: string,
  product: Product,
  index: number
): Scored {
  const desc = tokens(`${product.brand} ${product.description}`);
  const descSet = new Set(desc);
  const ing = tokens(option).filter((w) => !STOP.has(w));
  const noun = mainNoun(option);
  const nounHit = noun ? descSet.has(noun) : false;

  let score = nounHit ? 3 : -2;
  const matched = ing.filter((w) => descSet.has(w)).length;
  score += Math.min(matched, 3);
  if (ing.length > 0 && matched === ing.length) score += 1;

  const cats = (product.categories ?? []).join(" ").toLowerCase();
  const expected = EXPECTED_CATEGORY[listCategory];
  if (expected && cats && expected.test(cats)) score += 2;
  if (cats && BAD_CATEGORY.test(cats) && !tokens(option).some((w) => BAD_WORDS.has(w))) score -= 4;

  const ingAll = new Set(tokens(option));
  let bad = 0;
  for (const w of desc) if (BAD_WORDS.has(w) && !ingAll.has(w)) bad++;
  score -= Math.min(bad, 2) * 4;

  if (product.brand.toLowerCase().startsWith("kroger")) score += 0.3;
  score -= index * 0.05;
  return { product, score, nounHit };
}

export type Pick = { product: Product; confidence: "ok" | "low" } | null;

/** Tries each "or" option in order and takes the first confident match, else the best weak one. */
export async function pickProduct(
  name: string,
  listCategory: string,
  search: (term: string) => Promise<Product[]>
): Promise<Pick> {
  let bestWeak: Scored | null = null;
  for (const option of splitOptions(name)) {
    let results: Product[] = [];
    try {
      results = await search(option);
    } catch {
      continue;
    }
    if (!results.length) continue;
    const scored = results
      .map((p, i) => scoreProduct(option, listCategory, p, i))
      .sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (top.nounHit && top.score >= 4) return { product: top.product, confidence: "ok" };
    if (!bestWeak || top.score > bestWeak.score) bestWeak = top;
  }
  return bestWeak ? { product: bestWeak.product, confidence: "low" } : null;
}
