"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { addDays, todayET, weekStartOf } from "@/lib/dates";

type Db = Awaited<ReturnType<typeof requireHousehold>>["supabase"];

/** Notes that the plan changed in a way that can change the shopping list ("your plan changed since this list was built"). */
async function touchPlan(supabase: Db, weekId: string) {
  await supabase.from("weeks").update({ plan_changed_at: new Date().toISOString() }).eq("id", weekId);
}

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

const SLOTS = ["breakfast", "lunch", "dinner"];
const KINDS = ["leftovers", "out", "quick"];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const inWeek = (start: string, day: string) => isDate(day) && day >= start && day <= addDays(start, 6);

/** Adds a recipe to a day, or marks the day as leftovers / eating out / a quick night (kind). */
export async function addMeal(formData: FormData) {
  const day = String(formData.get("day"));
  // From a recipe page ("go") only the day is chosen, so the week follows from it.
  const weekStart = formData.get("go") && isDate(day) ? weekStartOf(day) : String(formData.get("week"));
  const slot = SLOTS.includes(String(formData.get("slot"))) ? String(formData.get("slot")) : "dinner";
  const recipeId = String(formData.get("recipe_id") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const kind = KINDS.includes(kindRaw) ? kindRaw : "recipe";
  if (!isDate(weekStart) || !inWeek(weekStart, day)) return;
  if (kind === "recipe" && !recipeId) return;

  const { supabase, householdId, week } = await ensureWeek(weekStart);
  if (kind === "recipe") {
    // RLS only lets us see this household's recipes, so a foreign id comes back empty.
    const { data: ok } = await supabase.from("recipes").select("id").eq("id", recipeId).maybeSingle();
    if (!ok) return;
  }
  await supabase.from("planned_meals").insert({
    household_id: householdId,
    week_id: week.id,
    day,
    slot,
    kind,
    recipe_id: kind === "recipe" ? recipeId : null,
  });
  if (kind === "recipe") await touchPlan(supabase, week.id);
  revalidatePath("/plan");
  if (formData.get("go")) redirect(`/plan?w=${weekStart}`);
}

export async function moveMeal(formData: FormData) {
  const { supabase } = await requireHousehold();
  const day = String(formData.get("day"));
  const { data: meal } = await supabase
    .from("planned_meals")
    .select("id, weeks(week_start)")
    .eq("id", String(formData.get("id")))
    .maybeSingle();
  const start = meal?.weeks?.week_start;
  if (!meal || !start || !inWeek(start, day)) return;
  await supabase.from("planned_meals").update({ day }).eq("id", meal.id);
  revalidatePath("/plan");
}

/** Saves the previewed fill: one dinner per empty day. Nothing is written until this runs. */
export async function keepFill(formData: FormData) {
  const weekStart = String(formData.get("week"));
  let picks: { day: string; recipe_id: string }[] = [];
  try {
    picks = JSON.parse(String(formData.get("picks") ?? "[]"));
  } catch {
    return;
  }
  if (!isDate(weekStart) || !Array.isArray(picks)) return;
  const { supabase, householdId, week } = await ensureWeek(weekStart);

  const { data: taken } = await supabase
    .from("planned_meals")
    .select("day")
    .eq("week_id", week.id)
    .eq("slot", "dinner");
  const takenDays = new Set((taken ?? []).map((t) => t.day));
  const ids = [...new Set(picks.map((p) => p.recipe_id))];
  const { data: ok } = await supabase.from("recipes").select("id").in("id", ids);
  const valid = new Set((ok ?? []).map((r) => r.id));

  const rows = picks
    .filter((p) => inWeek(weekStart, p.day) && !takenDays.has(p.day) && valid.has(p.recipe_id))
    .map((p) => ({
      household_id: householdId,
      week_id: week.id,
      day: p.day,
      slot: "dinner",
      kind: "recipe",
      recipe_id: p.recipe_id,
    }));
  if (rows.length) {
    await supabase.from("planned_meals").insert(rows);
    await touchPlan(supabase, week.id);
  }
  revalidatePath("/plan");
}

export async function removeMeal(formData: FormData) {
  const { supabase } = await requireHousehold();
  const id = String(formData.get("id"));
  const { data: meal } = await supabase.from("planned_meals").select("week_id, recipe_id").eq("id", id).maybeSingle();
  await supabase.from("planned_meals").delete().eq("id", id);
  if (meal?.recipe_id) await touchPlan(supabase, meal.week_id);
  revalidatePath("/plan");
}

/** Copies last week's meals (shifted +7 days) into the empty slots of this week. */
export async function copyLastWeek(formData: FormData): Promise<{ copied: number; lastWeekEmpty: boolean }> {
  const weekStart = String(formData.get("week"));
  const { supabase, householdId, week } = await ensureWeek(weekStart);
  const { data: prev } = await supabase
    .from("weeks")
    .select("id, mode")
    .eq("household_id", householdId)
    .eq("week_start", addDays(weekStart, -7))
    .maybeSingle();
  if (!prev) return { copied: 0, lastWeekEmpty: true };
  const { data: meals } = await supabase
    .from("planned_meals")
    .select("day, slot, kind, recipe_id, protein_lbs")
    .eq("week_id", prev.id);
  if (!meals?.length) return { copied: 0, lastWeekEmpty: true };

  // A day and meal that already has something stays as it is.
  const { data: taken } = await supabase.from("planned_meals").select("day, slot").eq("week_id", week.id);
  const used = new Set((taken ?? []).map((t) => `${t.day}|${t.slot}`));
  const toCopy = meals.filter((m) => !used.has(`${addDays(m.day, 7)}|${m.slot}`));
  if (!toCopy.length) return { copied: 0, lastWeekEmpty: false };

  await supabase.from("planned_meals").insert(
    toCopy.map((m) => ({
      household_id: householdId,
      week_id: week.id,
      day: addDays(m.day, 7),
      slot: m.slot,
      kind: m.kind,
      recipe_id: m.recipe_id,
      protein_lbs: m.protein_lbs,
    }))
  );
  if (toCopy.some((m) => m.recipe_id)) await touchPlan(supabase, week.id);
  // Only take over last week's home/travel setting when this week had nothing planned yet.
  if (!taken?.length) await supabase.from("weeks").update({ mode: prev.mode }).eq("id", week.id);
  revalidatePath("/plan");
  return { copied: toCopy.length, lastWeekEmpty: false };
}

/** Sets the meat weight for one planned meal. Blank means "use the household usual". */
export async function setMealProtein(formData: FormData) {
  const { supabase } = await requireHousehold();
  const raw = String(formData.get("lbs") ?? "").trim();
  const n = Number(raw);
  const lbs = raw === "" ? null : Number.isFinite(n) ? Math.min(10, Math.max(0.5, n)) : null;
  const { data: meal } = await supabase
    .from("planned_meals")
    .update({ protein_lbs: lbs })
    .eq("id", String(formData.get("id")))
    .select("week_id, recipe_id")
    .maybeSingle();
  if (meal?.recipe_id) await touchPlan(supabase, meal.week_id);
  revalidatePath("/plan");
}

/** After-dinner rating: 1 = liked, -1 = not a fan, 0 = skip. Also updates the recipe's overall rating. */
export async function rateMeal(formData: FormData) {
  const { supabase } = await requireHousehold();
  const n = Number(formData.get("rating"));
  if (n !== 1 && n !== -1 && n !== 0) return;
  const { data: meal } = await supabase
    .from("planned_meals")
    .update({ rating: n })
    .eq("id", String(formData.get("id")))
    .select("recipe_id")
    .maybeSingle();
  if (meal?.recipe_id && n !== 0) {
    await supabase.from("recipes").update({ rating: n }).eq("id", meal.recipe_id);
  }
  revalidatePath("/plan");
  revalidatePath("/recipes");
}

/** Saves the usual meat weight and dinner time together. */
export async function savePlanSettings(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  const update: { default_protein_lbs?: number; dinner_time?: string } = {};
  const n = Number(formData.get("lbs"));
  if (Number.isFinite(n) && formData.get("lbs") !== "") {
    update.default_protein_lbs = Math.min(10, Math.max(0.5, n));
  }
  const t = String(formData.get("time") ?? "");
  if (/^\d{2}:\d{2}$/.test(t)) update.dinner_time = t;
  const { data: before } = await supabase
    .from("households")
    .select("default_protein_lbs")
    .eq("id", householdId)
    .single();
  if (Object.keys(update).length) {
    await supabase.from("households").update(update).eq("id", householdId);
  }
  // A new usual meat weight changes the amounts on every upcoming list.
  if (update.default_protein_lbs !== undefined && Number(before?.default_protein_lbs) !== update.default_protein_lbs) {
    await supabase
      .from("weeks")
      .update({ plan_changed_at: new Date().toISOString() })
      .eq("household_id", householdId)
      .gte("week_start", weekStartOf(todayET()));
  }
  revalidatePath("/plan");
  revalidatePath("/settings");
  revalidatePath("/recipes", "layout");
}
