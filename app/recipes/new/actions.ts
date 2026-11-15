"use server";

import { findComponent, parseComponentLine } from "@/lib/components";
import { loadComponents } from "@/lib/load-components";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { ingredientKey, parseIngredient } from "@/lib/ingredients";
import { importRecipeFromUrl, type RecipeDraft } from "@/lib/recipe-import";
import { parseRecipeText } from "@/lib/recipe-text";

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

/** "Paste recipe text": splits a pasted block into a name, ingredients and steps for you to check. */
export async function importText(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireHousehold();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Paste the recipe text first." };
  if (text.length > 20_000) return { error: "That is too long to be one recipe." };
  const draft = parseRecipeText(text);
  if (!draft.ingredients && !draft.steps) {
    return { error: "Couldn't tell the ingredients from the steps. Put each ingredient on its own line, starting with the amount." };
  }
  return { draft, n: Date.now() };
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

export type SaveState = {
  /** Problems with a specific field, shown under that field. */
  errors?: { name?: string; ingredients?: string };
  /** A problem that isn't about one field (the save itself failed). */
  error?: string;
  /** Everything that was typed, handed back so a failed save doesn't wipe the form. */
  values?: Record<string, string>;
  /** Changes on every attempt, so the form knows to refill itself. */
  n?: number;
};

const fieldsOf = (formData: FormData) => {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") values[k] = v;
  return values;
};

/** Creates a recipe, or updates one when the form carries a recipe_id. */
export async function saveRecipe(_prev: SaveState | undefined, formData: FormData): Promise<SaveState> {
  const { supabase, householdId, user } = await requireHousehold();
  const editingId = String(formData.get("recipe_id") ?? "") || null;
  const values = fieldsOf(formData);
  const fail = (e: Omit<SaveState, "values" | "n">): SaveState => ({ ...e, values, n: Date.now() });

  const name = String(formData.get("name") ?? "").trim();
  const rawLines = String(formData.get("ingredients") ?? "").split("\n");
  const allComps = await loadComponents(supabase);
  const unknownComps: string[] = [];
  type Line = NonNullable<ReturnType<typeof parseIngredient>> & { component_id?: string; from_scratch?: boolean };
  const lines: Line[] = [];
  for (const raw of rawLines) {
    const cl = parseComponentLine(raw);
    if (cl) {
      const c = findComponent(cl.name, allComps);
      if (!c) {
        unknownComps.push(cl.name);
        continue;
      }
      lines.push({
        name: c.name,
        qty: cl.batches,
        unit: null,
        category: "pantry",
        family_only: cl.family_only,
        component_id: c.id,
        from_scratch: cl.from_scratch,
      });
      continue;
    }
    const p = parseIngredient(raw);
    if (p) lines.push(p);
  }

  // Check everything at once, so you can fix it all in one go.
  const errors: { name?: string; ingredients?: string } = {};
  if (!name) errors.name = "Give the recipe a name.";
  if (!lines.length) errors.ingredients = "Add at least one ingredient, one per line (like “2 lb ground beef”).";
  if (unknownComps.length) {
    errors.ingredients = `No component called ${unknownComps.map((n) => `“${n}”`).join(", ")}. Add it under Recipes, then Components, or take the @ off the line.`;
  }
  if (errors.name || errors.ingredients) return fail({ errors });

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
    const prev = l.component_id ? undefined : oldByKey.get(ingredientKey(l.name));
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
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null,
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
    if (error || !data) return fail({ error: "Couldn't save your changes. Try again." });
    recipeId = data.id;
  } else {
    const { data, error } = await supabase
      .from("recipes")
      .insert({ ...fields, household_id: householdId, source: "custom", created_by: user.id })
      .select("id")
      .single();
    if (error || !data) return fail({ error: "Couldn't save the recipe. Try again." });
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
      component_id: "component_id" in ing ? ing.component_id : null,
      from_scratch: "from_scratch" in ing ? ing.from_scratch : true,
      sort: i,
    }))
  );
  if (e2) {
    if (!editingId) await supabase.from("recipes").delete().eq("id", recipeId);
    return fail({ error: "Couldn't save the ingredients. Try again." });
  }
  if (old.length) {
    await supabase.from("recipe_ingredients").delete().in("id", old.map((o) => o.id));
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${recipeId}`);
}
