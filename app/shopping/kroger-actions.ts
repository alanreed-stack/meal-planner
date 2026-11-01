"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { addToCart, refreshToken, searchProducts } from "@/lib/kroger";

async function storeId() {
  const ctx = await requireHousehold();
  const { data } = await ctx.supabase
    .from("households")
    .select("kroger_location_id")
    .eq("id", ctx.householdId)
    .single();
  return { ...ctx, locationId: data?.kroger_location_id as string | null };
}

export async function setStore(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  await supabase
    .from("households")
    .update({
      kroger_location_id: String(formData.get("id")),
      kroger_store_name: String(formData.get("name")),
    })
    .eq("id", householdId);
  revalidatePath("/shopping");
}

export async function clearStore() {
  const { supabase, householdId } = await requireHousehold();
  await supabase
    .from("households")
    .update({ kroger_location_id: null, kroger_store_name: null })
    .eq("id", householdId);
  revalidatePath("/shopping");
}

/** Finds a best-guess Kroger product for every item to order that has no match yet. */
export async function matchItems(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const { supabase, householdId, locationId } = await storeId();
  if (!locationId) return;

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) return;

  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, name")
    .eq("week_id", week.id)
    .eq("to_order", true)
    .is("kroger_upc", null);

  const todo = items ?? [];
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(
      todo.slice(i, i + 5).map(async (item) => {
        try {
          const [p] = await searchProducts(item.name, locationId, 1);
          if (!p) return;
          await supabase
            .from("shopping_items")
            .update({
              kroger_upc: p.upc,
              kroger_product_id: p.productId,
              kroger_description: [p.brand, p.description, p.size].filter(Boolean).join(" · "),
              kroger_price: p.price,
            })
            .eq("id", item.id);
        } catch {
          // leave unmatched; the user can search by hand
        }
      })
    );
  }
  revalidatePath("/shopping");
}

export async function chooseProduct(formData: FormData) {
  const { supabase } = await requireHousehold();
  const price = Number(formData.get("price"));
  await supabase
    .from("shopping_items")
    .update({
      kroger_upc: String(formData.get("upc")),
      kroger_product_id: String(formData.get("product_id")),
      kroger_description: String(formData.get("description")),
      kroger_price: Number.isFinite(price) && price > 0 ? price : null,
      sent_at: null,
    })
    .eq("id", String(formData.get("id")));
  redirect("/shopping");
}

export async function setQty(formData: FormData) {
  const { supabase } = await requireHousehold();
  const qty = Math.min(50, Math.max(1, Math.round(Number(formData.get("qty")) || 1)));
  await supabase
    .from("shopping_items")
    .update({ order_qty: qty, sent_at: null })
    .eq("id", String(formData.get("id")));
  revalidatePath("/shopping");
}

export async function sendToCart(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const { supabase, user, householdId } = await requireHousehold();

  const { data: conn } = await supabase
    .from("kroger_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn) redirect("/shopping?kroger=notconnected");

  let token = conn.access_token;
  if (new Date(conn.expires_at).getTime() < Date.now() + 60_000) {
    if (!conn.refresh_token) redirect("/shopping?kroger=notconnected");
    try {
      const t = await refreshToken(conn.refresh_token);
      token = t.access_token;
      await supabase
        .from("kroger_connections")
        .update({
          access_token: t.access_token,
          refresh_token: t.refresh_token ?? conn.refresh_token,
          expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch {
      redirect("/shopping?kroger=notconnected");
    }
  }

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) redirect("/shopping");

  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, kroger_upc, order_qty")
    .eq("week_id", week.id)
    .eq("to_order", true)
    .not("kroger_upc", "is", null)
    .is("sent_at", null);
  if (!items?.length) redirect("/shopping?kroger=nothing");

  let ok = true;
  try {
    await addToCart(
      token,
      items.map((i) => ({ upc: i.kroger_upc as string, quantity: i.order_qty }))
    );
  } catch {
    ok = false;
  }
  if (!ok) redirect("/shopping?kroger=cartfail");

  await supabase
    .from("shopping_items")
    .update({ sent_at: new Date().toISOString() })
    .in("id", items.map((i) => i.id));
  redirect(`/shopping?kroger=sent&n=${items.length}`);
}
