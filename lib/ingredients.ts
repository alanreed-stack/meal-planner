// Turns a line like "1 1/2 lb ground beef, browned" into { qty: 1.5, unit: "lb", name: "ground beef" }.

const FRACTIONS: Record<string, number> = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625,
};

const UNITS: Record<string, string> = {
  cup: "cup", cups: "cup",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbsps: "tbsp", tbs: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", tsps: "tsp",
  pound: "lb", pounds: "lb", lb: "lb", lbs: "lb",
  ounce: "oz", ounces: "oz", oz: "oz",
  gram: "g", grams: "g", g: "g", kg: "kg", ml: "ml", l: "l",
  can: "can", cans: "can",
  clove: "clove", cloves: "clove",
  slice: "slice", slices: "slice",
  pinch: "pinch", dash: "dash",
  bunch: "bunch", head: "head", heads: "head",
  jar: "jar", jars: "jar", bag: "bag", bags: "bag", box: "box", boxes: "box",
  pack: "pack", packs: "pack", packet: "packet", packets: "packet", package: "package", packages: "package", pkg: "package",
  stick: "stick", sticks: "stick",
  piece: "piece", pieces: "piece",
  bottle: "bottle", bottles: "bottle", tub: "tub", tubs: "tub",
  loaf: "loaf", loaves: "loaf", pint: "pint", pints: "pint",
};

function parseNumber(token: string): number | null {
  // "1½", "½", "1/2", "2.5", "3"
  const t = token.trim();
  const uni = [...t].find((c) => FRACTIONS[c] !== undefined);
  if (uni) {
    const whole = parseFloat(t.replace(uni, "")) || 0;
    return whole + FRACTIONS[uni];
  }
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b ? a / b : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The shopping aisle a name points to, or null when nothing in it gives a clue (e.g. "paper towels"). */
export function guessAisle(name: string): string | null {
  const n = name.toLowerCase();
  const has = (words: string[]) => words.some((w) => n.includes(w));
  if (n.includes("frozen")) return "frozen";
  if (/\bsalt\b|to taste|black pepper|ground pepper|pepper flakes|peppercorn/.test(n)) return "pantry";
  if (has(["peanut butter", "almond butter", "coconut milk", "coconut cream", "broth", "stock", "cream of", "buttermilk powder"]))
    return "pantry";
  if (has(["eggplant", "onion", "garlic", "pepper", "tomato", "lettuce", "spinach", "broccoli", "carrot", "celery", "potato", "lemon", "lime", "avocado", "cucumber", "zucchini", "mushroom", "ginger", "cilantro", "parsley", "basil", "apple", "banana", "berries", "berry", "asparagus", "cauliflower", "cabbage", "kale", "squash", "scallion", "green bean", "coleslaw", "salad", "herb", "thyme", "rosemary", "dill", "mint"]) &&
    !has(["sauce", "paste", "powder", "canned", "diced tomatoes", "dried", "sun-dried"]))
    return "produce";
  if (has(["chicken", "beef", "pork", "sausage", "bacon", "turkey", "steak", "salmon", "shrimp", "fish", "ham", "lamb", "ground meat", "tuna fillet", "tenders", "thigh", "breast", "brisket", "ribs"]))
    return "meat";
  if (has(["milk", "cheese", "butter", "cream", "yogurt", "egg", "parmesan", "mozzarella", "cheddar", "ricotta"]))
    return "dairy";
  if (has(["bread", "bun", "tortilla", "bagel", "roll", "pita", "naan"])) return "bakery";
  return null;
}

export function guessCategory(name: string): string {
  return guessAisle(name) ?? "pantry";
}

export type ParsedIngredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  category: string;
  family_only: boolean;
};

/** A leading "+" marks a family-only ingredient (not needed for the keto plate). */
export function parseIngredient(rawLine: string): ParsedIngredient | null {
  let line = rawLine.trim();
  if (!line) return null;
  let family_only = false;
  if (line.startsWith("+")) {
    family_only = true;
    line = line.slice(1).trim();
  }
  line = line.replace(/^[-*•]\s*/, "");

  let qty: number | null = null;
  let unit: string | null = null;

  const m = line.match(/^((?:\d+\s+)?\d+\/\d+|\d*[½¼¾⅓⅔⅛⅜⅝]|\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(?:(?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?))?\s*/i);
  let rest = line;
  if (m) {
    const parts = m[1].trim().split(/\s+/);
    const total = parts.reduce((sum, p) => sum + (parseNumber(p) ?? 0), 0);
    qty = total > 0 ? round(total) : null;
    rest = line.slice(m[0].length);
  }

  rest = rest.replace(/^\([^)]*\)\s*/, ""); // "1 (14 oz) can" -> "1 can"
  const w = rest.match(/^([a-zA-Z]+)\.?\s+/);
  if (w && UNITS[w[1].toLowerCase()]) {
    unit = UNITS[w[1].toLowerCase()];
    rest = rest.slice(w[0].length);
  }
  rest = rest.replace(/^of\s+/i, "");

  const name = rest
    .replace(/\([^)]*\)/g, "")
    .split(",")[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return null;

  return { name, qty, unit, category: guessCategory(name), family_only };
}

/** The reverse of parseIngredient: a stored ingredient back into an editable line. */
export function ingredientToLine(i: {
  name: string;
  qty: number | null;
  unit: string | null;
  family_only: boolean;
}): string {
  const qty = i.qty == null ? "" : String(Math.round(Number(i.qty) * 100) / 100);
  return [i.family_only ? "+" : "", qty, i.unit ?? "", i.name].filter(Boolean).join(" ");
}

/** Lowercase name without "(canned)"-style notes, so an edited line can find the stored ingredient. */
export const ingredientKey = (name: string) =>
  name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
