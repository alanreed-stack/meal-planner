"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";

const keyOf = (name: string) => name.trim().toLowerCase();

// A starting point: spices, oils and sauces most kitchens already have.
const USUAL = [
  "olive oil", "sesame oil", "paprika", "cumin", "chili powder", "dried oregano", "Italian seasoning",
  "garam masala", "curry powder", "cinnamon", "turmeric", "red pepper flakes", "garlic powder",
  "taco seasoning", "Cajun seasoning", "fajita seasoning", "soy sauce or coconut aminos", "rice vinegar",
  "red wine vinegar", "fish sauce",
];

/** Adds one thing to "things we always have". If it came from a list row, that row is unchecked too. */
export async function addStaple(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { supabase, householdId } = await requireHousehold();
  await supabase
    .from("pantry_staples")
    .upsert({ household_id: householdId, name_key: keyOf(name), name }, { onConflict: "household_id,name_key" });

  const itemId = String(formData.get("item_id") ?? "");
  if (itemId) await supabase.from("shopping_items").update({ to_order: false }).eq("id", itemId);
  revalidatePath("/settings");
  revalidatePath("/shopping");
}

export async function removeStaple(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  await supabase
    .from("pantry_staples")
    .delete()
    .eq("household_id", householdId)
    .eq("name_key", String(formData.get("name_key")));
  revalidatePath("/settings");
}

export async function addUsualStaples() {
  const { supabase, householdId } = await requireHousehold();
  await supabase.from("pantry_staples").upsert(
    USUAL.map((name) => ({ household_id: householdId, name_key: keyOf(name), name })),
    { onConflict: "household_id,name_key", ignoreDuplicates: true }
  );
  revalidatePath("/settings");
}
