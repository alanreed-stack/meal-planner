// Works out how many store packages cover what a recipe needs.
import { formatAmount } from "./format";

type Kind = "weight" | "volume" | "count";
export type PackSize = { kind: Kind; amount: number }; // weight in oz, volume in fl oz, count in units

export function parseSize(text: string | null | undefined): PackSize | null {
  if (!text) return null;
  const m = text
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|lbs?|pt|qt|gal|ml|kg|g|l|ct|count|ea|each|pk|pack)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].replace(/\s+/g, "").replace(".", "");
  switch (u) {
    case "oz": return { kind: "weight", amount: n };
    case "lb": case "lbs": return { kind: "weight", amount: n * 16 };
    case "g": return { kind: "weight", amount: n * 0.035274 };
    case "kg": return { kind: "weight", amount: n * 35.274 };
    case "floz": return { kind: "volume", amount: n };
    case "pt": return { kind: "volume", amount: n * 16 };
    case "qt": return { kind: "volume", amount: n * 32 };
    case "gal": return { kind: "volume", amount: n * 128 };
    case "ml": return { kind: "volume", amount: n * 0.033814 };
    case "l": return { kind: "volume", amount: n * 33.814 };
    default: return { kind: "count", amount: n };
  }
}

const WEIGHT_OZ: Record<string, number> = { lb: 16, oz: 1, g: 0.035274, kg: 35.274 };
const VOLUME_FLOZ: Record<string, number> = { cup: 8, tbsp: 0.5, tsp: 1 / 6 };
const PACK_UNITS = new Set([
  "can", "jar", "bag", "box", "pack", "packet", "package", "bunch", "head", "bottle", "loaf", "tub", "pint", "stick",
]);

// Rough weight of one piece, in oz. Used only to turn "8 thighs" into pounds, so it is an estimate.
const PIECE_OZ: [RegExp, number][] = [
  [/bone-in.*chicken thigh|chicken thigh.*bone-in/, 6.5],
  [/chicken thigh/, 4.5],
  [/chicken breast/, 8],
  [/salmon fillet|cod fillet/, 6],
  [/baby potato/, 3],
  [/potato/, 8],
  [/onion/, 8],
  [/bell pepper/, 6],
  [/broccoli crown/, 8],
  [/zucchini/, 8],
  [/cucumber/, 10],
  [/avocado/, 6],
  [/lemon/, 4],
  [/lime/, 2],
  [/^tomato|tomatoes$/, 6],
];

// Ounces per cup, for recipes that measure solids by the cup.
const OZ_PER_CUP: [RegExp, number][] = [
  [/shredded|cheese|cheddar|mozzarella|feta|ricotta/, 4],
  [/parmesan/, 3.5],
  [/rice/, 6.5],
  [/flour/, 4.5],
  [/sun-dried tomato/, 2.5],
  [/peanut|almond|walnut|pecan/, 5],
  [/spinach|kale/, 1.2],
];

export type PackResult = {
  packs: number;
  flag: boolean; // true when we couldn't work it out and left it at 1
  estimated: boolean;
  note: string;
};

const ceilTol = (x: number) => Math.max(1, Math.ceil(x - 0.03));

export function packagesNeeded(
  need: { qty: number | null; unit: string | null; name: string },
  sizeText: string | null | undefined
): PackResult {
  const { qty, unit } = need;
  const name = need.name.toLowerCase();
  const size = parseSize(sizeText);
  const sizeLabel = sizeText ? ` × ${sizeText}` : "";

  if (qty == null || qty <= 0) return { packs: 1, flag: false, estimated: false, note: "" };
  const needText = formatAmount(qty, unit);
  const done = (packs: number, estimated = false): PackResult => ({
    packs: Math.min(50, packs),
    flag: false,
    estimated,
    note: `Need ${needText} · buying ${Math.min(50, packs)}${sizeLabel}${estimated ? " (est.)" : ""}`,
  });
  const unsure = (): PackResult => ({
    packs: 1, flag: true, estimated: false, note: `Need ${needText} · check quantity`,
  });

  // The recipe already counts packages ("2 jars marinara"): buy that many.
  if (unit && PACK_UNITS.has(unit)) return done(ceilTol(qty));

  if (!size) return unsure();

  // Weight needed.
  if (unit && WEIGHT_OZ[unit]) {
    const oz = qty * WEIGHT_OZ[unit];
    if (size.kind === "weight") return done(ceilTol(oz / size.amount));
    return unsure();
  }

  // Volume needed.
  if (unit && VOLUME_FLOZ[unit]) {
    const floz = qty * VOLUME_FLOZ[unit];
    if (size.kind === "volume") return done(ceilTol(floz / size.amount));
    if (size.kind === "weight") {
      const dens = OZ_PER_CUP.find(([re]) => re.test(name));
      if (dens) return done(ceilTol(((floz / 8) * dens[1]) / size.amount), true);
    }
    // A spoonful or two of something from a bottle or jar: one package covers it.
    if (floz <= 8) return done(1, true);
    return unsure();
  }

  // Counted things: cloves, slices, pieces.
  if (unit === "clove" && /garlic/.test(name) && size.kind === "count") return done(ceilTol(qty / 10), true);
  if (unit === "piece" || unit === "slice" || !unit) {
    if (size.kind === "count") return done(ceilTol(qty / size.amount));
    if (size.kind === "weight") {
      const per = PIECE_OZ.find(([re]) => re.test(name));
      if (per) return done(ceilTol((qty * per[1]) / size.amount), true);
    }
  }
  return unsure();
}
