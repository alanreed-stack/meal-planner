"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

/** Changes your own name and whether you eat keto. (Each person only ever changes their own row.) */
export async function saveMember(formData: FormData) {
  const { supabase, householdId, user } = await requireHousehold();
  const name = String(formData.get("display_name") ?? "").trim().slice(0, 40);
  await supabase
    .from("household_members")
    .update({ display_name: name || null, eats_keto: formData.get("keto") === "on" })
    .eq("household_id", householdId)
    .eq("user_id", user.id);
  revalidatePath("/settings");
  revalidatePath("/");
}

/** Leaves the household. The last person cannot leave, because nobody would be left to reach its recipes and plans. */
export async function leaveHousehold() {
  const { supabase, householdId, user } = await requireHousehold();
  const { count } = await supabase
    .from("household_members")
    .select("user_id", { count: "exact", head: true })
    .eq("household_id", householdId);
  if ((count ?? 0) < 2) redirect("/settings?left=last");
  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", user.id);
  if (error) redirect("/settings?left=failed");
  redirect("/setup");
}

/** Light, dark, or follow the phone. Remembered on this device in a cookie, so the first paint is already right. */
export async function setTheme(choice: "auto" | "light" | "dark") {
  const jar = await cookies();
  if (choice === "light" || choice === "dark") {
    jar.set("theme", choice, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } else {
    jar.delete("theme");
  }
}
