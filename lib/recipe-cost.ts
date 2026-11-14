// Estimates what a recipe costs at the household's Kroger, from prices already saved for matched products.
import { packagesNeeded } from "./packaging";
import { niceQty } from "./scale";

export const costKey = (name: string) => name.trim().toLowerCase();

export type SavedMatch = { price: number | null; size: string | null; description: string | null };

export type CostLine = {
  name: string;
  packs: number;
  price: number;
  cost: number;
  product: string;
  familyOnly: boolean;
  /** We could not work out how many packages; counted as one. */
  check: boolean;
};

export type RecipeCost = {
  total: number;
  familyOnlyTotal: number;
  lines: CostLine[];
  /** Ingredients with no saved Kroger price yet. */
  missing: string[];
  /** Left out because they are in "things we always have". */
  staples: string[];
  perServing: number | null;
};

export function estimateCost(
  ings: { name: string; qty: number | null; unit: string | null; family_only: boolean }[],
  factor: number,
  servings: number,
  matches: Map<string, SavedMatch>,
  staples: Set<string>
): RecipeCost {
  const lines: CostLine[] = [];
  const missing: string[] = [];
  const skipped: string[] = [];
  for (const i of ings) {
    const key = costKey(i.name);
    if (staples.has(key)) {
      skipped.push(i.name);
      continue;
    }
    const m = matches.get(key);
    if (!m || m.price == null) {
      missing.push(i.name);
      continue;
    }
    const qty = i.qty == null ? null : niceQty(i.qty * factor, i.unit);
    const { packs, flag } = packagesNeeded({ qty, unit: i.unit, name: i.name }, m.size);
    lines.push({
      name: i.name,
      packs,
      price: m.price,
      cost: packs * m.price,
      product: m.description ?? "",
      familyOnly: i.family_only,
      check: flag,
    });
  }
  const total = lines.reduce((s, l) => s + l.cost, 0);
  const familyOnlyTotal = lines.filter((l) => l.familyOnly).reduce((s, l) => s + l.cost, 0);
  return {
    total,
    familyOnlyTotal,
    lines,
    missing,
    staples: skipped,
    perServing: servings > 0 && lines.length > 0 ? total / servings : null,
  };
}

export const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * The cost to rank a recipe by, or null when too few of its ingredients have a price for the number to mean anything
 * (a recipe with no prices would otherwise look like the cheapest one).
 */
export function costIfKnown(c: RecipeCost): number | null {
  const priced = c.lines.length;
  if (priced === 0) return null;
  return priced / (priced + c.missing.length) >= 0.7 ? c.total : null;
}
