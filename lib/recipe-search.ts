// Searching the recipe book as you type: by name, tag or ingredient.

/** Everything searchable about a recipe, lowercased, in one string. */
export function searchText(r: { name: string; description?: string | null; tags?: string[] | null }, ingredientNames: string[]): string {
  return [r.name, ...(r.tags ?? []), ...ingredientNames, r.description ?? ""].join(" | ").toLowerCase();
}

/**
 * Every word you typed has to appear somewhere (so "turkey chili" finds a chili made with turkey, and "turk" finds
 * turkey). Dashes and extra spaces do not matter. An empty search matches everything.
 */
export function matchesQuery(text: string, query: string): boolean {
  const words = query.toLowerCase().replace(/[-–]/g, " ").split(/\s+/).filter(Boolean);
  const flat = text.replace(/[-–]/g, " ");
  return words.every((w) => flat.includes(w));
}
