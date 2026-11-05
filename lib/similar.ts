import { tokens } from "./match";

// Whole foods where two differently-named list items are often really the same shopping trip item.
const BASE = new Set([
  "broccoli", "cauliflower", "spinach", "lettuce", "tomato", "onion", "pepper", "potato", "mushroom",
  "zucchini", "cabbage", "cucumber", "carrot", "celery", "kale", "avocado", "lemon", "lime", "cilantro",
  "parsley", "basil", "mint", "ginger", "garlic",
]);

const base = (name: string) => tokens(name).filter((w) => BASE.has(w));

/** Name of another item on the list that looks like a near-duplicate, if any. Hint only, never merged. */
export function similarTo<T extends { id: string; name: string; category: string }>(
  item: T,
  all: T[]
): string | null {
  const mine = base(item.name);
  if (!mine.length) return null;
  for (const other of all) {
    if (other.id === item.id || other.category !== item.category) continue;
    if (other.name.trim().toLowerCase() === item.name.trim().toLowerCase()) continue;
    if (base(other.name).some((w) => mine.includes(w))) return other.name;
  }
  return null;
}
