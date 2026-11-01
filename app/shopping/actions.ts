"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";

/** Rebuilds the auto-generated part of the list from the week's planned meals.
 *  Items you added by hand are kept. Merges the same ingredient+unit across recipes. */
export async function generateList(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const { supabase, householdId } = await requireHousehold();

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) return;

  const { data: meals } = await supabase
    .from("planned_meals")
    .select("recipe_id")
    .eq("week_id", week.id);
  const recipeIds = (meals ?? []).map((m) => m.recipe_id).filter(Boolean) as string[];

  // Keep the checkbox choices for items that survive regeneration.
  const { data: old } = await supabase
    .from("shopping_items")
    .select("name, unit, to_order")
    .eq("week_id", week.id)
    .eq("manual", false);
  const key = (name: string, unit: string | null) =>
    `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
  const wasOff = new Set((old ?? []).filter((o) => !o.to_order).map((o) => key(o.name, o.unit)));

  const merged = new Map<
    string,
    { name: string; unit: string | null; qty: number | null; category: string }
  >();
  if (recipeIds.length) {
    const { data: ings } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, qty, unit, category")
      .in("recipe_id", recipeIds);
    // A recipe planned twice needs its ingredients twice.
    const timesPlanned = new Map<string, number>();
    recipeIds.forEach((id) => timesPlanned.set(id, (timesPlanned.get(id) ?? 0) + 1));
    for (const ing of ings ?? []) {
      const k = key(ing.name, ing.unit);
      const times = timesPlanned.get(ing.recipe_id) ?? 1;
      const add = ing.qty == null ? null : Number(ing.qty) * times;
      const cur = merged.get(k);
      if (!cur) {
        merged.set(k, { name: ing.name, unit: ing.unit, qty: add, category: ing.category });
      } else if (add != null) {
        cur.qty = (cur.qty ?? 0) + add;
      }
    }
  }

  const { data: saved } = await supabase
    .from("kroger_matches")
    .select("name_key, upc, product_id, description, price, order_qty")
    .eq("household_id", householdId);
  const savedBy = new Map((saved ?? []).map((m) => [m.name_key, m]));

  await supabase.from("shopping_items").delete().eq("week_id", week.id).eq("manual", false);
  if (merged.size) {
    const { error } = await supabase.from("shopping_items").insert(
      [...merged.entries()].map(([k, v]) => {
        const m = savedBy.get(v.name.trim().toLowerCase());
        return {
          household_id: householdId,
          week_id: week.id,
          name: v.name,
          unit: v.unit,
          qty: v.qty == null ? null : Math.round(v.qty * 100) / 100,
          category: v.category,
          to_order: !wasOff.has(k),
          manual: false,
          kroger_upc: m?.upc ?? null,
          kroger_product_id: m?.product_id ?? null,
          kroger_description: m?.description ?? null,
          kroger_price: m?.price ?? null,
          order_qty: m?.order_qty ?? 1,
        };
      })
    );
    if (error) throw error;
  }
  revalidatePath("/shopping");
}

export async function toggleItem(formData: FormData) {
  const { supabase } = await requireHousehold();
  const id = String(formData.get("id"));
  const next = formData.get("to_order") !== "true";
  await supabase.from("shopping_items").update({ to_order: next }).eq("id", id);
  revalidatePath("/shopping");
}

export async function deleteItem(formData: FormData) {
  const { supabase } = await requireHousehold();
  await supabase.from("shopping_items").delete().eq("id", String(formData.get("id")));
  revalidatePath("/shopping");
}

export async function addItem(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { supabase, householdId } = await requireHousehold();

  let { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) {
    const { data } = await supabase
      .from("weeks")
      .insert({ household_id: householdId, week_start: weekStart })
      .select("id")
      .single();
    week = data;
  }
  const qty = Number(formData.get("qty"));
  const { data: m } = await supabase
    .from("kroger_matches")
    .select("upc, product_id, description, price, order_qty")
    .eq("household_id", householdId)
    .eq("name_key", name.toLowerCase())
    .maybeSingle();
  await supabase.from("shopping_items").insert({
    kroger_upc: m?.upc ?? null,
    kroger_product_id: m?.product_id ?? null,
    kroger_description: m?.description ?? null,
    kroger_price: m?.price ?? null,
    order_qty: m?.order_qty ?? 1,
    household_id: householdId,
    week_id: week!.id,
    name,
    qty: Number.isFinite(qty) && qty > 0 ? qty : null,
    unit: String(formData.get("unit") ?? "").trim() || null,
    category: String(formData.get("category") ?? "other"),
    manual: true,
  });
  revalidatePath("/shopping");
}
