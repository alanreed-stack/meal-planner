// Finding Kroger products for a week's shopping items. Shared by the "Match items" button and by building the list.
import type { createClient } from "@/lib/supabase/server";
import { searchProducts } from "./kroger";
import { pickProduct } from "./match";
import { packagesNeeded } from "./packaging";

type Db = Awaited<ReturnType<typeof createClient>>;

const keyOf = (name: string) => name.trim().toLowerCase();

/** Saves the product chosen for an ingredient name, so the next list reuses it. */
export async function rememberMatch(
  supabase: Db,
  householdId: string,
  name: string,
  m: {
    upc: string;
    product_id: string;
    description: string;
    size: string | null;
    price: number | null;
    confidence: "ok" | "low";
    image?: string | null;
    resetQty?: boolean;
  }
) {
  await supabase.from("kroger_matches").upsert({
    household_id: householdId,
    name_key: keyOf(name),
    upc: m.upc,
    product_id: m.product_id,
    description: m.description,
    size: m.size,
    price: m.price,
    confidence: m.confidence,
    image_url: m.image ?? null,
    // A different product has a different package size, so an old override no longer applies.
    ...(m.resetQty ? { qty_override: null } : {}),
    updated_at: new Date().toISOString(),
  });
}

/** Re-works packages to buy for matched items you haven't set by hand. */
export async function recalcQuantities(supabase: Db, weekId: string) {
  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, name, qty, unit, kroger_size, order_qty, order_qty_manual")
    .eq("week_id", weekId)
    .eq("to_order", true)
    .eq("order_qty_manual", false)
    .not("kroger_upc", "is", null);
  for (const it of items ?? []) {
    const { packs } = packagesNeeded(
      { qty: it.qty == null ? null : Number(it.qty), unit: it.unit, name: it.name },
      it.kroger_size
    );
    if (packs !== it.order_qty) {
      await supabase.from("shopping_items").update({ order_qty: packs }).eq("id", it.id);
    }
  }
}

/** Finds a Kroger product for every item to order that has no match yet, and works out packages. Returns how many got one. */
export async function matchWeekItems(
  supabase: Db,
  householdId: string,
  locationId: string,
  weekId: string
): Promise<number> {
  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, name, qty, unit, category, order_qty_manual")
    .eq("week_id", weekId)
    .eq("to_order", true)
    .is("kroger_upc", null);

  const todo = items ?? [];
  let matched = 0;
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (item) => {
        try {
          const pick = await pickProduct(item.name, item.category, (term) =>
            searchProducts(term.replace(/[()]/g, " "), locationId, 10)
          );
          if (!pick) return;
          const p = pick.product;
          const description = [p.brand, p.description, p.size].filter(Boolean).join(" · ");
          const { packs } = packagesNeeded(
            { qty: item.qty == null ? null : Number(item.qty), unit: item.unit, name: item.name },
            p.size
          );
          await supabase
            .from("shopping_items")
            .update({
              kroger_upc: p.upc,
              kroger_product_id: p.productId,
              kroger_description: description,
              kroger_size: p.size || null,
              kroger_price: p.price,
              match_confidence: pick.confidence,
              kroger_image: p.image,
              ...(item.order_qty_manual ? {} : { order_qty: packs }),
              sent_at: null,
              sent_qty: 0,
            })
            .eq("id", item.id);
          await rememberMatch(supabase, householdId, item.name, {
            upc: p.upc,
            product_id: p.productId,
            description,
            size: p.size || null,
            price: p.price,
            confidence: pick.confidence,
            image: p.image,
          });
          matched++;
        } catch {
          // leave unmatched; the user can search by hand
        }
      })
    );
  }
  await recalcQuantities(supabase, weekId);
  return matched;
}
