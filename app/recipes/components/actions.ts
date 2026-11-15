"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { parseIngredient } from "@/lib/ingredients";

const back = (id: string | null, error: string) =>
  redirect(`/recipes/components/${id ?? "new"}?error=${encodeURIComponent(error)}`);

/** Creates a component, or updates one when the form carries an id. Its ingredients are one per line, like a recipe's. */
export async function saveComponent(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const buyAs = String(formData.get("buy_as") ?? "").trim().slice(0, 80) || null;
  const buyUnit = String(formData.get("buy_unit") ?? "").trim().toLowerCase().slice(0, 20) || "jar";
  const lines = String(formData.get("ingredients") ?? "")
    .split("\n")
    .map(parseIngredient)
    .filter((i): i is NonNullable<typeof i> => !!i);

  if (!name) back(id, "Give it a name, like “Pico de gallo”.");
  if (!lines.length) back(id, "Add at least one ingredient, one per line (like “4 tomatoes”).");
  if (name.startsWith("@") || name.startsWith("+")) back(id, "The name can't start with @ or +.");

  // Same name twice would make "@Pico de gallo" ambiguous.
  const { data: same } = await supabase
    .from("components")
    .select("id")
    .eq("household_id", householdId)
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"));
  if ((same ?? []).some((c) => c.id !== id)) back(id, `You already have a component called “${name}”.`);

  let componentId = id;
  if (id) {
    const { error } = await supabase.from("components").update({ name, buy_as: buyAs, buy_unit: buyUnit }).eq("id", id);
    if (error) back(id, "Couldn't save your changes. Try again.");
  } else {
    const { data, error } = await supabase
      .from("components")
      .insert({ household_id: householdId, name, buy_as: buyAs, buy_unit: buyUnit })
      .select("id")
      .single();
    if (error || !data) back(null, "Couldn't save it. Try again.");
    componentId = data!.id;
  }

  // Add the new rows first and only then remove the old ones, so a failure loses nothing.
  const { data: old } = await supabase.from("component_ingredients").select("id").eq("component_id", componentId!);
  const { error: e2 } = await supabase.from("component_ingredients").insert(
    lines.map((l, i) => ({
      component_id: componentId!,
      household_id: householdId,
      name: l.name,
      qty: l.qty,
      unit: l.unit,
      category: l.category,
      sort: i,
    }))
  );
  if (e2) {
    if (!id) await supabase.from("components").delete().eq("id", componentId!);
    back(id, "Couldn't save the ingredients. Try again.");
  }
  if (old?.length) await supabase.from("component_ingredients").delete().in("id", old.map((o) => o.id));

  // Recipes that use it now read differently, so a list built from them may be out of date.
  if (id) await flagUsers(id);
  revalidatePath("/recipes", "layout");
  redirect("/recipes/components?saved=1");
}

async function flagUsers(componentId: string) {
  const { supabase } = await requireHousehold();
  const { data: rows } = await supabase.from("recipe_ingredients").select("recipe_id").eq("component_id", componentId);
  const recipeIds = [...new Set((rows ?? []).map((r) => r.recipe_id))];
  if (!recipeIds.length) return;
  const { data: meals } = await supabase.from("planned_meals").select("week_id").in("recipe_id", recipeIds);
  const weekIds = [...new Set((meals ?? []).map((m) => m.week_id))];
  if (weekIds.length) await supabase.from("weeks").update({ plan_changed_at: new Date().toISOString() }).in("id", weekIds);
}

/** Deletes a component, unless a recipe still uses it. */
export async function deleteComponent(formData: FormData) {
  const { supabase } = await requireHousehold();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { count } = await supabase
    .from("recipe_ingredients")
    .select("id", { count: "exact", head: true })
    .eq("component_id", id);
  if (count) back(id, `${count === 1 ? "A recipe uses" : `${count} recipes use`} this. Take it out of ${count === 1 ? "that recipe" : "those recipes"} first.`);
  await supabase.from("components").delete().eq("id", id);
  revalidatePath("/recipes", "layout");
  redirect("/recipes/components?removed=1");
}
