"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { niceQty, scaleFactor } from "@/lib/scale";
import { packagesNeeded } from "@/lib/packaging";
import { guessAisle } from "@/lib/ingredients";
import { splitOptions } from "@/lib/match";

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
    .select("recipe_id, protein_lbs")
    .eq("week_id", week.id);
  const recipeIds = [...new Set((meals ?? []).map((m) => m.recipe_id).filter(Boolean) as string[])];
  const { data: hh } = await supabase
    .from("households")
    .select("default_protein_lbs")
    .eq("id", householdId)
    .single();
  const defaultLbs = Number(hh?.default_protein_lbs ?? 2);

  // Keep the checkbox choices for items that survive regeneration.
  const { data: old } = await supabase
    .from("shopping_items")
    .select("name, unit, to_order")
    .eq("week_id", week.id)
    .eq("manual", false);
  const key = (name: string, unit: string | null) =>
    `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
  const wasOff = new Set((old ?? []).filter((o) => !o.to_order).map((o) => key(o.name, o.unit)));

  // Things the household always has: left unchecked so they don't get ordered every week.
  const { data: staples } = await supabase
    .from("pantry_staples")
    .select("name_key")
    .eq("household_id", householdId);
  const alwaysHave = new Set((staples ?? []).map((s) => s.name_key));

  const merged = new Map<
    string,
    { name: string; unit: string | null; qty: number | null; category: string }
  >();
  if (recipeIds.length) {
    const { data: ings } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, qty, unit, category")
      .in("recipe_id", recipeIds);
    const byRecipe = new Map<string, typeof ings>();
    for (const ing of ings ?? []) {
      const list = byRecipe.get(ing.recipe_id) ?? [];
      list.push(ing);
      byRecipe.set(ing.recipe_id, list);
    }
    // Each planned meal adds its own ingredients, scaled to that meal's meat weight.
    for (const meal of meals ?? []) {
      if (!meal.recipe_id) continue;
      const list = byRecipe.get(meal.recipe_id) ?? [];
      const factor = scaleFactor(
        list.map((i) => ({ ...i, qty: i.qty == null ? null : Number(i.qty) })),
        Number(meal.protein_lbs ?? defaultLbs)
      );
      for (const ing of list) {
        const k = key(ing.name, ing.unit);
        const add = ing.qty == null ? null : Number(ing.qty) * factor;
        const cur = merged.get(k);
        if (!cur) {
          merged.set(k, { name: ing.name, unit: ing.unit, qty: add, category: ing.category });
        } else if (add != null) {
          cur.qty = (cur.qty ?? 0) + add;
        }
      }
    }
  }

  // "ziti or penne" is already covered when "penne" is on the list too: fold it in.
  for (const [k, v] of [...merged]) {
    if (!/\s+or\s+/i.test(v.name)) continue;
    const options = splitOptions(v.name).map((o) => o.toLowerCase());
    for (const [k2, v2] of merged) {
      if (k2 === k || (v2.unit ?? "") !== (v.unit ?? "")) continue;
      if (!options.includes(v2.name.trim().toLowerCase())) continue;
      v2.qty = v2.qty == null && v.qty == null ? null : (v2.qty ?? 0) + (v.qty ?? 0);
      merged.delete(k);
      break;
    }
  }

  const { data: saved } = await supabase
    .from("kroger_matches")
    .select("name_key, upc, product_id, description, size, price, confidence, qty_override")
    .eq("household_id", householdId);
  const savedBy = new Map((saved ?? []).map((m) => [m.name_key, m]));

  await supabase.from("shopping_items").delete().eq("week_id", week.id).eq("manual", false);
  if (merged.size) {
    const { error } = await supabase.from("shopping_items").insert(
      [...merged.entries()].map(([k, v]) => {
        const m = savedBy.get(v.name.trim().toLowerCase());
        const qty = v.qty == null ? null : niceQty(v.qty, v.unit);
        const packs = m
          ? (m.qty_override ??
            packagesNeeded({ qty, unit: v.unit, name: v.name }, m.size).packs)
          : 1;
        return {
          household_id: householdId,
          week_id: week.id,
          name: v.name,
          unit: v.unit,
          qty,
          category: v.category,
          to_order: !wasOff.has(k) && !alwaysHave.has(v.name.trim().toLowerCase()),
          manual: false,
          kroger_upc: m?.upc ?? null,
          kroger_product_id: m?.product_id ?? null,
          kroger_description: m?.description ?? null,
          kroger_price: m?.price ?? null,
          kroger_size: m?.size ?? null,
          match_confidence: m?.confidence ?? null,
          order_qty: packs,
          order_qty_manual: m?.qty_override != null,
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
  // "auto" (or nothing chosen) means: guess the aisle from the name, and fall back to "other".
  const picked = String(formData.get("category") ?? "auto");
  const category = picked && picked !== "auto" ? picked : (guessAisle(name) ?? "other");
  const { data: m } = await supabase
    .from("kroger_matches")
    .select("upc, product_id, description, size, price, confidence, qty_override")
    .eq("household_id", householdId)
    .eq("name_key", name.toLowerCase())
    .maybeSingle();
  const addQty = Number(formData.get("qty"));
  const packs = m
    ? (m.qty_override ??
      packagesNeeded(
        { qty: Number.isFinite(addQty) && addQty > 0 ? addQty : null, unit: String(formData.get("unit") ?? "").trim() || null, name },
        m.size
      ).packs)
    : 1;
  await supabase.from("shopping_items").insert({
    kroger_upc: m?.upc ?? null,
    kroger_product_id: m?.product_id ?? null,
    kroger_description: m?.description ?? null,
    kroger_price: m?.price ?? null,
    kroger_size: m?.size ?? null,
    match_confidence: m?.confidence ?? null,
    order_qty: packs,
    order_qty_manual: m?.qty_override != null,
    household_id: householdId,
    week_id: week!.id,
    name,
    qty: Number.isFinite(qty) && qty > 0 ? qty : null,
    unit: String(formData.get("unit") ?? "").trim() || null,
    category,
    manual: true,
  });
  revalidatePath("/shopping");
}

/** In-store checklist: marks an item as picked up. No page refresh needed. */
export async function setPicked(id: string, picked: boolean) {
  const { supabase } = await requireHousehold();
  await supabase.from("shopping_items").update({ picked }).eq("id", id);
}

/** Starts the in-store checklist over for a week. */
export async function resetPicked(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const { supabase, householdId } = await requireHousehold();
  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (week) await supabase.from("shopping_items").update({ picked: false }).eq("week_id", week.id);
  revalidatePath("/shopping/store");
}
