"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { addDays, todayET, weekStartOf } from "@/lib/dates";

/** Switches one component line in a recipe between making it from scratch and buying it. */
export async function setComponentMode(formData: FormData) {
  const rowId = String(formData.get("row_id") ?? "");
  const recipeId = String(formData.get("recipe_id") ?? "");
  const scratch = formData.get("mode") !== "buy";
  const { supabase, householdId } = await requireHousehold();
  if (!rowId || !recipeId) return;

  await supabase
    .from("recipe_ingredients")
    .update({ from_scratch: scratch })
    .eq("id", rowId)
    .eq("recipe_id", recipeId)
    .eq("household_id", householdId)
    .not("component_id", "is", null);

  // Weeks from this one on that use the recipe now have a list that may be out of date.
  const thisWeek = weekStartOf(todayET());
  const { data: meals } = await supabase
    .from("planned_meals")
    .select("week_id, weeks!inner(week_start)")
    .eq("recipe_id", recipeId)
    .gte("weeks.week_start", addDays(thisWeek, 0));
  const weekIds = [...new Set((meals ?? []).map((m) => m.week_id))];
  if (weekIds.length) {
    await supabase.from("weeks").update({ plan_changed_at: new Date().toISOString() }).in("id", weekIds);
  }
  revalidatePath(`/recipes/${recipeId}`);
}
