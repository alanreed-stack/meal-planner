"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { addToCart, refreshToken, searchProducts } from "@/lib/kroger";
import { pickProduct } from "@/lib/match";
import { packagesNeeded } from "@/lib/packaging";

const keyOf = (name: string) => name.trim().toLowerCase();

type Db = Awaited<ReturnType<typeof requireHousehold>>["supabase"];

async function remember(
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
    // A different product has a different package size, so an old override no longer applies.
    ...(m.resetQty ? { qty_override: null } : {}),
    updated_at: new Date().toISOString(),
  });
}

/** Re-works packages to buy for matched items you haven't set by hand. */
async function recalcQuantities(supabase: Db, weekId: string) {
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

/** Finds a Kroger product for every item to order that has no match yet, and works out packages. */
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
    .select("id, name, qty, unit, category, order_qty_manual")
    .eq("week_id", week.id)
    .eq("to_order", true)
    .is("kroger_upc", null);

  const todo = items ?? [];
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
              ...(item.order_qty_manual ? {} : { order_qty: packs }),
              sent_at: null,
            })
            .eq("id", item.id);
          await remember(supabase, householdId, item.name, {
            upc: p.upc,
            product_id: p.productId,
            description,
            size: p.size || null,
            price: p.price,
            confidence: pick.confidence,
          });
        } catch {
          // leave unmatched; the user can search by hand
        }
      })
    );
  }
  await recalcQuantities(supabase, week.id);
  revalidatePath("/shopping");
}

export async function chooseProduct(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  const price = Number(formData.get("price"));
  const cleanPrice = Number.isFinite(price) && price > 0 ? price : null;
  const size = String(formData.get("size") ?? "") || null;
  const upc = String(formData.get("upc"));
  const productId = String(formData.get("product_id"));
  const description = String(formData.get("description"));

  const { data: it } = await supabase
    .from("shopping_items")
    .select("name, qty, unit")
    .eq("id", String(formData.get("id")))
    .single();
  if (it) {
    await remember(supabase, householdId, it.name, {
      upc,
      product_id: productId,
      description,
      size,
      price: cleanPrice,
      confidence: "ok",
      resetQty: true,
    });
    const { packs } = packagesNeeded(
      { qty: it.qty == null ? null : Number(it.qty), unit: it.unit, name: it.name },
      size
    );
    await supabase
      .from("shopping_items")
      .update({
        kroger_upc: upc,
        kroger_product_id: productId,
        kroger_description: description,
        kroger_size: size,
        kroger_price: cleanPrice,
        match_confidence: "ok",
        order_qty: packs,
        order_qty_manual: false,
        sent_at: null,
      })
      .eq("id", String(formData.get("id")));
  }
  redirect("/shopping");
}

/** Sets the number of packages by hand. Leave the box empty to go back to automatic. */
export async function setQty(formData: FormData) {
  const { supabase, householdId } = await requireHousehold();
  const raw = String(formData.get("qty") ?? "").trim();
  const id = String(formData.get("id"));

  const { data: it } = await supabase
    .from("shopping_items")
    .select("name, qty, unit, kroger_size")
    .eq("id", id)
    .single();
  if (!it) return;

  if (raw === "") {
    const { packs } = packagesNeeded(
      { qty: it.qty == null ? null : Number(it.qty), unit: it.unit, name: it.name },
      it.kroger_size
    );
    await supabase
      .from("shopping_items")
      .update({ order_qty: packs, order_qty_manual: false, sent_at: null })
      .eq("id", id);
    await supabase
      .from("kroger_matches")
      .update({ qty_override: null })
      .eq("household_id", householdId)
      .eq("name_key", keyOf(it.name));
  } else {
    const qty = Math.min(50, Math.max(1, Math.round(Number(raw) || 1)));
    await supabase
      .from("shopping_items")
      .update({ order_qty: qty, order_qty_manual: true, sent_at: null })
      .eq("id", id);
    await supabase
      .from("kroger_matches")
      .update({ qty_override: qty })
      .eq("household_id", householdId)
      .eq("name_key", keyOf(it.name));
  }
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

  await recalcQuantities(supabase, week.id);

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
