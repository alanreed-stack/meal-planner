"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { addDays } from "@/lib/dates";

async function ensureWeek(weekStart: string) {
  const { supabase, householdId } = await requireHousehold();
  const { data: existing } = await supabase
    .from("weeks")
    .select("id, mode")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existing) return { supabase, householdId, week: existing };
  const { data, error } = await supabase
    .from("weeks")
    .insert({ household_id: householdId, week_start: weekStart })
    .select("id, mode")
    .single();
  if (error) throw error;
  return { supabase, householdId, week: data };
}

export async function setMode(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const mode = formData.get("mode") === "travel" ? "travel" : "home";
  const { supabase, week } = await ensureWeek(weekStart);
  await supabase.from("weeks").update({ mode }).eq("id", week.id);
  revalidatePath("/plan");
}

export async function addMeal(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const day = String(formData.get("day"));
  const slot = String(formData.get("slot") ?? "dinner");
  const recipeId = String(formData.get("recipe_id") ?? "");
  if (!recipeId) return;
  const { supabase, householdId, week } = await ensureWeek(weekStart);
  await supabase.from("planned_meals").insert({
    household_id: householdId,
    week_id: week.id,
    day,
    slot,
    recipe_id: recipeId,
  });
  revalidatePath("/plan");
}

export async function removeMeal(formData: FormData) {
  const { supabase } = await requireHousehold();
  await supabase.from("planned_meals").delete().eq("id", String(formData.get("id")));
  revalidatePath("/plan");
}

/** Copies last week's meals (shifted +7 days) into this week. */
export async function copyLastWeek(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const { supabase, householdId, week } = await ensureWeek(weekStart);
  const { data: prev } = await supabase
    .from("weeks")
    .select("id, mode")
    .eq("household_id", householdId)
    .eq("week_start", addDays(weekStart, -7))
    .maybeSingle();
  if (!prev) return;
  const { data: meals } = await supabase
    .from("planned_meals")
    .select("day, slot, recipe_id, protein_lbs")
    .eq("week_id", prev.id);
  if (!meals?.length) return;
  await supabase.from("planned_meals").insert(
    meals.map((m) => ({
      household_id: householdId,
      week_id: week.id,
      day: addDays(m.day, 7),
      slot: m.slot,
      recipe_id: m.recipe_id,
      protein_lbs: m.protein_lbs,
    }))
  );
  await supabase.from("weeks").update({ mode: prev.mode }).eq("id", week.id);
  revalidatePath("/plan");
}

/** Sets the meat weight for one planned meal. Blank means "use the household usual". */
export async function setMealProtein(formData: FormData) {
  const { supabase } = await requireHousehold();
  const raw = String(formData.get("lbs") ?? "").trim();
  const n = Number(raw);
  const lbs = raw === "" ? null : Number.isFinite(n) ? Math.min(10, Math.max(0.5, n)) : null;
  await supabase
    .from("planned_meals")
    .update({ protein_lbs: lbs })
    .eq("id", String(formData.get("id")));
  revalidatePath("/plan");
}

export async function setDefaultProtein(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  const n = Number(formData.get("lbs"));
  if (!Number.isFinite(n)) return;
  await supabase
    .from("households")
    .update({ default_protein_lbs: Math.min(10, Math.max(0.5, n)) })
    .eq("id", householdId);
  revalidatePath("/plan");
  revalidatePath("/recipes", "layout");
}
