import type { SupabaseClient } from "@supabase/supabase-js";
import pack1 from "@/data/starter-recipes.json";
import pack2 from "@/data/starter-recipes-2.json";

const starter = [...pack1, ...pack2];

/** How many starter recipes this household doesn't have yet. */
export async function missingStarterCount(supabase: SupabaseClient, householdId: string) {
  const { data } = await supabase.from("recipes").select("slug").eq("household_id", householdId);
  const have = new Set((data ?? []).map((r) => r.slug));
  return starter.filter((r) => !have.has(r.slug)).length;
}

type StarterIngredient = {
  name: string;
  qty?: number;
  unit?: string;
  category?: string;
  family_only?: boolean;
};

/** Copies the starter recipes into a household. Safe to run twice (skips existing slugs). */
export async function seedStarterRecipes(
  supabase: SupabaseClient,
  householdId: string,
  userId: string
) {
  const { data: existing } = await supabase
    .from("recipes")
    .select("slug")
    .eq("household_id", householdId);
  const have = new Set((existing ?? []).map((r) => r.slug));
  const todo = starter.filter((r) => !have.has(r.slug));
  if (todo.length === 0) return 0;

  const { data: inserted, error } = await supabase
    .from("recipes")
    .insert(
      todo.map((r) => ({
        household_id: householdId,
        slug: r.slug,
        name: r.name,
        description: r.description,
        diet: r.diet,
        keto_swap: r.keto_swap || null,
        prep_minutes: r.prep_minutes,
        cook_minutes: r.cook_minutes,
        servings: r.servings,
        difficulty: r.difficulty,
        tags: r.tags,
        steps: r.steps,
        source: "starter",
        created_by: userId,
      }))
    )
    .select("id, slug");
  if (error) throw error;

  const idBySlug = new Map(inserted!.map((r) => [r.slug, r.id]));
  const rows = todo.flatMap((r) =>
    (r.ingredients as StarterIngredient[]).map((ing, i) => ({
      recipe_id: idBySlug.get(r.slug)!,
      household_id: householdId,
      name: ing.name,
      qty: ing.qty ?? null,
      unit: ing.unit ?? null,
      category: ing.category ?? "pantry",
      family_only: ing.family_only ?? false,
      sort: i,
    }))
  );
  const { error: e2 } = await supabase.from("recipe_ingredients").insert(rows);
  if (e2) throw e2;
  return todo.length;
}
