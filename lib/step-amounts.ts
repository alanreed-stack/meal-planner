// For each step of a recipe, the ingredients it mentions and how much to use, so nobody has to scroll back up.
// Each ingredient shows at the first step that names it. Matching is by words, so it is a good guess, not a promise.

export type StepIngredient = { name: string; text: string };

const STOP = new Set(["of", "and", "or", "fresh", "large", "small", "medium", "dried", "ground", "shredded", "diced", "sliced", "chopped", "minced", "cooked", "frozen", "boneless", "skinless", "extra", "virgin", "light", "low", "sodium", "whole", "plain", "unsalted", "salted"]);

/** Singular-ish lowercase words of a name: "Chicken breasts (boneless)" -> ["chicken", "breast"]. */
function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("oes") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

const stepWords = (step: string) => new Set(words(step));

/**
 * `ingredients` are already scaled and formatted ("2 lb ground beef"). Returns, per step, the ones that step uses first.
 * An ingredient matches when every meaningful word of its name is in the step, or, failing that, when its last word
 * (the noun: "beef", "garlic") is in the step and no other ingredient ends in the same word.
 */
export function amountsByStep(steps: string[], ingredients: StepIngredient[]): StepIngredient[][] {
  // "sirloin or ribeye steak" can be written in the step as any of its options.
  const info = ingredients.map((i) => {
    const options = i.name.split(/\s+or\s+/i).map((o) => {
      const w = words(o);
      const key = w.filter((x) => !STOP.has(x) && x.length > 1);
      return { key: key.length ? key : w, noun: w[w.length - 1] ?? "" };
    });
    return { i, options };
  });
  // How many ingredients each word belongs to: a word only one ingredient has is a safe clue on its own.
  const count = new Map<string, number>();
  for (const x of info) for (const w of new Set(x.options.flatMap((o) => o.key))) count.set(w, (count.get(w) ?? 0) + 1);
  const nounCount = new Map<string, number>();
  for (const x of info) for (const o of x.options) nounCount.set(o.noun, (nounCount.get(o.noun) ?? 0) + 1);

  const used = new Set<number>();
  return steps.map((step) => {
    const sw = stepWords(step);
    const out: StepIngredient[] = [];
    info.forEach((x, n) => {
      if (used.has(n)) return;
      const hit = x.options.some(
        (o) =>
          o.key.length > 0 &&
          (o.key.every((k) => sw.has(k)) ||
            (o.noun.length >= 4 && sw.has(o.noun) && nounCount.get(o.noun) === 1) ||
            o.key.some((k) => k.length >= 5 && sw.has(k) && count.get(k) === 1))
      );
      if (hit) {
        used.add(n);
        out.push(x.i);
      }
    });
    return out;
  });
}
