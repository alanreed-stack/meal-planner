"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";

export async function toggleFavorite(formData: FormData) {
  const { supabase } = await requireHousehold();
  const id = String(formData.get("id"));
  const next = formData.get("favorite") !== "true";
  await supabase.from("recipes").update({ favorite: next }).eq("id", id);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

/** 1 = liked, -1 = not a fan, 0 = clear. Thumbs-down recipes are suggested less. */
export async function rateRecipe(formData: FormData) {
  const { supabase } = await requireHousehold();
  const n = Number(formData.get("rating"));
  const rating = n === 1 || n === -1 ? n : null;
  const id = String(formData.get("id"));
  await supabase.from("recipes").update({ rating }).eq("id", id);
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
}

/** Makes a copy of a recipe (for a variation) and opens it to edit. */
export async function duplicateRecipe(formData: FormData) {
  const { supabase, householdId, user } = await requireHousehold();
  const id = String(formData.get("id"));
  const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!r) return;
  const { data: copy } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      name: `${r.name} (copy)`.slice(0, 120),
      description: r.description,
      diet: r.diet,
      keto_swap: r.keto_swap,
      notes: r.notes,
      prep_minutes: r.prep_minutes,
      cook_minutes: r.cook_minutes,
      servings: r.servings,
      difficulty: r.difficulty,
      tags: r.tags,
      steps: r.steps,
      image_url: r.image_url,
      source: "custom",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (!copy) return;

  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("name, qty, unit, category, family_only, sort, component_id, from_scratch")
    .eq("recipe_id", id)
    .order("sort");
  if (ings?.length) {
    const { error } = await supabase
      .from("recipe_ingredients")
      .insert(ings.map((i) => ({ ...i, recipe_id: copy.id, household_id: householdId })));
    if (error) {
      await supabase.from("recipes").delete().eq("id", copy.id);
      return;
    }
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${copy.id}/edit`);
}
