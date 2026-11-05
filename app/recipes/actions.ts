"use server";

import { revalidatePath } from "next/cache";
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
