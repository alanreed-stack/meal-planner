"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { searchProducts } from "@/lib/kroger";
import { pickProduct } from "@/lib/match";
import { costKey } from "@/lib/recipe-cost";

/**
 * Looks up Kroger prices for this recipe's ingredients that have none saved yet.
 * It saves them the same way the shopping list does, so the list reuses them later.
 */
export async function priceRecipe(formData: FormData) {
  const id = String(formData.get("recipe_id") ?? "");
  const { supabase, householdId } = await requireHousehold();
  const { data: hh } = await supabase
    .from("households")
    .select("kroger_location_id")
    .eq("id", householdId)
    .single();
  const locationId = hh?.kroger_location_id as string | null;
  if (!locationId || !id) return;

  const { data: ings } = await supabase.from("recipe_ingredients").select("name, category").eq("recipe_id", id);
  const keys = (ings ?? []).map((i) => costKey(i.name));
  const [{ data: have }, { data: staples }] = await Promise.all([
    supabase.from("kroger_matches").select("name_key, price").eq("household_id", householdId).in("name_key", keys),
    supabase.from("pantry_staples").select("name_key").eq("household_id", householdId).in("name_key", keys),
  ]);
  const priced = new Set((have ?? []).filter((m) => m.price != null).map((m) => m.name_key));
  const skip = new Set((staples ?? []).map((s) => s.name_key));
  const todo = (ings ?? []).filter((i) => !priced.has(costKey(i.name)) && !skip.has(costKey(i.name)));

  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (item) => {
        try {
          const pick = await pickProduct(item.name, item.category, (term) =>
            searchProducts(term.replace(/[()]/g, " "), locationId, 10)
          );
          if (!pick) return;
          const p = pick.product;
          await supabase.from("kroger_matches").upsert({
            household_id: householdId,
            name_key: costKey(item.name),
            upc: p.upc,
            product_id: p.productId,
            description: [p.brand, p.description, p.size].filter(Boolean).join(" · "),
            size: p.size || null,
            price: p.price,
            confidence: pick.confidence,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // leave it unpriced; it shows up in "no price yet"
        }
      })
    );
  }
  revalidatePath(`/recipes/${id}`);
}
