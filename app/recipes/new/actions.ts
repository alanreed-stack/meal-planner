"use server";

import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { parseIngredient } from "@/lib/ingredients";
import { importRecipeFromUrl, type RecipeDraft } from "@/lib/recipe-import";

type ImportState = { draft?: RecipeDraft; error?: string; n?: number };

export async function importRecipe(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireHousehold();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Paste a link first." };
  try {
    return { draft: await importRecipeFromUrl(url), n: Date.now() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't import that link." };
  }
}

const int = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function saveRecipe(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, householdId, user } = await requireHousehold();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the recipe a name." };

  const ingredients = String(formData.get("ingredients") ?? "")
    .split("\n")
    .map(parseIngredient)
    .filter((i): i is NonNullable<typeof i> => !!i);
  if (!ingredients.length) return { error: "Add at least one ingredient." };

  const diet = ["both", "family", "keto"].includes(String(formData.get("diet")))
    ? String(formData.get("diet"))
    : "both";
  const difficulty = ["easy", "medium", "hard"].includes(String(formData.get("difficulty")))
    ? String(formData.get("difficulty"))
    : "easy";

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      diet,
      keto_swap: String(formData.get("keto_swap") ?? "").trim() || null,
      prep_minutes: int(formData.get("prep_minutes")),
      cook_minutes: int(formData.get("cook_minutes")),
      servings: int(formData.get("servings")) || 4,
      difficulty,
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      steps: String(formData.get("steps") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      source: "custom",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !recipe) return { error: "Couldn't save the recipe. Try again." };

  const { error: e2 } = await supabase.from("recipe_ingredients").insert(
    ingredients.map((ing, i) => ({
      recipe_id: recipe.id,
      household_id: householdId,
      name: ing.name,
      qty: ing.qty,
      unit: ing.unit,
      category: ing.category,
      family_only: ing.family_only,
      sort: i,
    }))
  );
  if (e2) {
    await supabase.from("recipes").delete().eq("id", recipe.id);
    return { error: "Couldn't save the ingredients. Try again." };
  }
  redirect(`/recipes/${recipe.id}`);
}
