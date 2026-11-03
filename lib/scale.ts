// Scales a recipe so its meat weighs a chosen number of pounds, and scales everything else with it.

type Ing = { name: string; qty: number | null; unit: string | null; category: string };

// Meat sold by the piece or pack: rough weight in pounds each.
const PIECE_LBS: Record<string, number> = {
  "bone-in chicken thighs": 0.4,
  "salmon fillets": 0.4,
  "cod fillets": 0.4,
  "smoked sausage": 0.75,
  "breakfast sausage": 0.75,
};

/** Total pounds of meat in the recipe as written, or null if we can't tell. */
export function proteinLbs(ings: Ing[]): number | null {
  let total = 0;
  for (const i of ings) {
    if (i.category !== "meat" || i.qty == null) continue;
    const qty = Number(i.qty);
    if (i.unit === "lb") total += qty;
    else {
      const w = PIECE_LBS[i.name.trim().toLowerCase()];
      if (w) total += qty * w;
    }
  }
  return total > 0 ? total : null;
}

/** Multiplier to apply to every ingredient. 1 when the recipe has no weighable meat. */
export function scaleFactor(ings: Ing[], targetLbs: number): number {
  const base = proteinLbs(ings);
  return base ? targetLbs / base : 1;
}

// Things you count: always round up so nobody runs short.
const COUNTED = new Set(["piece", "clove", "slice", "stick"]);
// Things sold in packages: round to the nearest whole one, so 1.33 boxes of pasta is 1, not 2.
const PACKAGED = new Set([
  "can", "jar", "bag", "box", "pack", "packet", "package", "bunch", "head", "bottle", "loaf", "tub", "pint",
]);

export function niceQty(qty: number, unit: string | null): number {
  if (unit && COUNTED.has(unit)) return Math.max(1, Math.ceil(qty - 0.05));
  if (unit && PACKAGED.has(unit)) return Math.max(1, Math.round(qty));
  return Math.round(qty * 100) / 100;
}
