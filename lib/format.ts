// Kitchen-style display: fractions, plural units, no "piece", clean names.

const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
];

/** 1.33 -> "1 ⅓", 0.5 -> "½", 3 -> "3". */
export function formatQty(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  let whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.0625) return String(whole);
  if (frac > 0.9375) return String(whole + 1);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  whole = Math.max(whole, 0);
  return whole ? `${whole} ${best[1]}` : best[1];
}

const PLURAL_UNITS: Record<string, string> = {
  cup: "cups", clove: "cloves", head: "heads", can: "cans", jar: "jars", bag: "bags",
  box: "boxes", pack: "packs", packet: "packets", package: "packages", bunch: "bunches",
  slice: "slices", stick: "sticks", bottle: "bottles", loaf: "loaves", tub: "tubs",
  pint: "pints", pinch: "pinches", dash: "dashes",
};

/** The unit word for display. "piece" is dropped because "8 bone-in chicken thighs" reads better. */
export function unitLabel(unit: string | null, qty: number): string {
  if (!unit || unit === "piece") return "";
  const plural = qty > 1.0001;
  return plural ? PLURAL_UNITS[unit] ?? unit : unit;
}

const IRREGULAR: Record<string, string> = { tomato: "tomatoes", potato: "potatoes", avocado: "avocados", jalapeno: "jalapenos" };

export function pluralizeName(name: string): string {
  const m = name.match(/^(.*?)([A-Za-z-]+)(\s*\(.*\))?$/);
  if (!m) return name;
  const [, head, last, tail = ""] = m;
  const lower = last.toLowerCase();
  let out = last;
  if (IRREGULAR[lower]) out = IRREGULAR[lower];
  else if (lower.endsWith("s")) out = last;
  else if (/[^aeiou]y$/.test(lower)) out = last.slice(0, -1) + "ies";
  else if (/(ch|sh|x|z)$/.test(lower)) out = last + "es";
  else out = last + "s";
  return head + out + tail;
}

/** "diced tomatoes (canned)" bought by the can is just "diced tomatoes". */
export function displayName(name: string, unit: string | null): string {
  if (unit === "can" || unit === "jar") return name.replace(/\s*\((canned|jarred)\)\s*$/i, "").trim();
  return name.trim();
}

export function formatIngredient(qty: number | null, unit: string | null, name: string): string {
  const clean = displayName(name, unit);
  if (qty == null) return clean;
  const label = unitLabel(unit, qty);
  const noun = unit === "piece" && qty > 1.0001 ? pluralizeName(clean) : clean;
  return [formatQty(qty), label, noun].filter(Boolean).join(" ");
}

/** The amount only, e.g. "4 lb" or "1 ⅓ cups". Used in "Need 4 lb · buying 4 × 1 lb". */
export function formatAmount(qty: number, unit: string | null): string {
  const label = unit === "piece" ? (qty > 1.0001 ? "pieces" : "piece") : unitLabel(unit, qty);
  return [formatQty(qty), label].filter(Boolean).join(" ");
}

/** 245 -> "4 hr 5 min", 60 -> "1 hr", 45 -> "45 min". */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null || min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "18:00:00" + minutes back -> "9:50 AM". */
export function clockBefore(dinner: string, minutesBefore: number): string {
  const [h, m] = dinner.split(":").map(Number);
  let t = h * 60 + m - minutesBefore;
  t = ((t % 1440) + 1440) % 1440;
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}
