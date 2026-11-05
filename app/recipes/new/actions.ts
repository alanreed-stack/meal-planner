"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { ingredientKey, parseIngredient } from "@/lib/ingredients";
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

const httpsOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Creates a recipe, or updates one when the form carries a recipe_id. */
export async function saveRecipe(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, householdId, user } = await requireHousehold();
  const editingId = String(formData.get("recipe_id") ?? "") || null;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the recipe a name." };

  const lines = String(formData.get("ingredients") ?? "")
    .split("\n")
    .map(parseIngredient)
    .filter((i): i is NonNullable<typeof i> => !!i);
  if (!lines.length) return { error: "Add at least one ingredient." };

  // When editing, keep the stored name (e.g. "diced tomatoes (canned)") and aisle for lines that
  // still match, so Kroger matches and the shopping list keep working.
  let old: { id: string; name: string; category: string }[] = [];
  if (editingId) {
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("id, name, category")
      .eq("recipe_id", editingId);
    old = data ?? [];
  }
  const oldByKey = new Map(old.map((o) => [ingredientKey(o.name), o]));
  const ingredients = lines.map((l) => {
    const prev = oldByKey.get(ingredientKey(l.name));
    return prev ? { ...l, name: prev.name, category: prev.category } : l;
  });

  const diet = ["both", "family", "keto"].includes(String(formData.get("diet")))
    ? String(formData.get("diet"))
    : "both";
  const difficulty = ["easy", "medium", "hard"].includes(String(formData.get("difficulty")))
    ? String(formData.get("difficulty"))
    : "easy";

  const fields = {
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
    image_url: httpsOrNull(formData.get("image_url")),
  };

  let recipeId: string;
  if (editingId) {
    const { data, error } = await supabase
      .from("recipes")
      .update(fields)
      .eq("id", editingId)
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't save your changes. Try again." };
    recipeId = data.id;
  } else {
    const { data, error } = await supabase
      .from("recipes")
      .insert({ ...fields, household_id: householdId, source: "custom", created_by: user.id })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't save the recipe. Try again." };
    recipeId = data.id;
  }

  // Add the new ingredient rows first and only then remove the old ones, so a failure loses nothing.
  const { error: e2 } = await supabase.from("recipe_ingredients").insert(
    ingredients.map((ing, i) => ({
      recipe_id: recipeId,
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
    if (!editingId) await supabase.from("recipes").delete().eq("id", recipeId);
    return { error: "Couldn't save the ingredients. Try again." };
  }
  if (old.length) {
    await supabase.from("recipe_ingredients").delete().in("id", old.map((o) => o.id));
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${recipeId}`);
}
