"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { addToCart, KrogerError, refreshToken } from "@/lib/kroger";
import { matchWeekItems, recalcQuantities, rememberMatch } from "@/lib/match-items";
import { packagesNeeded } from "@/lib/packaging";

const keyOf = (name: string) => name.trim().toLowerCase();

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
  const zip = String(formData.get("zip") ?? "").trim();
  await supabase
    .from("households")
    .update({
      kroger_location_id: String(formData.get("id")),
      kroger_store_name: String(formData.get("name")),
      ...(/^\d{5}$/.test(zip) ? { zip } : {}),
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

  await matchWeekItems(supabase, householdId, locationId, week.id);
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
  const image = String(formData.get("image") ?? "");
  const imageUrl = image.startsWith("https://") ? image : null;
  const aisle = String(formData.get("aisle") ?? "").trim().slice(0, 60) || null;

  const { data: it } = await supabase
    .from("shopping_items")
    .select("name, qty, unit, weeks(week_start)")
    .eq("id", String(formData.get("id")))
    .single();
  const weekStart = it?.weeks?.week_start;
  if (it) {
    await rememberMatch(supabase, householdId, it.name, {
      upc,
      product_id: productId,
      description,
      size,
      price: cleanPrice,
      confidence: "ok",
      image: imageUrl,
      aisle,
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
        kroger_image: imageUrl,
        kroger_aisle: aisle,
        match_confidence: "ok",
        order_qty: packs,
        order_qty_manual: false,
        sent_at: null,
        sent_qty: 0, // a different product: nothing of it is in the cart yet
      })
      .eq("id", String(formData.get("id")));
  }
  redirect(`/shopping${weekStart ? `?w=${weekStart}` : ""}#item-${String(formData.get("id"))}`);
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

/** The plus and minus on a list row: sets the number of packages by hand. */
export async function setPacks(id: string, qty: number) {
  const { supabase, householdId } = await requireHousehold();
  const n = Math.min(50, Math.max(1, Math.round(Number(qty) || 1)));
  const { data: it } = await supabase.from("shopping_items").select("name, sent_at, sent_qty").eq("id", id).single();
  if (!it) return;
  // If the cart already holds at least this many, the row stays "in cart"; otherwise it needs sending again.
  const covered = it.sent_qty > 0 && it.sent_qty >= n;
  await supabase
    .from("shopping_items")
    .update({ order_qty: n, order_qty_manual: true, sent_at: covered ? (it.sent_at ?? new Date().toISOString()) : null })
    .eq("id", id);
  await supabase.from("kroger_matches").update({ qty_override: n }).eq("household_id", householdId).eq("name_key", keyOf(it.name));
  revalidatePath("/shopping");
}

export async function sendToCart(formData: FormData) {
  const weekStart = String(formData.get("week"));
  const { supabase, user, householdId } = await requireHousehold();
  // Always come back to the week you were looking at.
  const back = (status: string) => `/shopping?kroger=${status}&w=${weekStart}`;

  const { data: conn } = await supabase
    .from("kroger_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn) redirect(back("notconnected"));

  let token = conn.access_token;
  if (new Date(conn.expires_at).getTime() < Date.now() + 60_000) {
    if (!conn.refresh_token) redirect(back("expired"));
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
      // The refresh token no longer works, so the login has to be done again.
      redirect(back("expired"));
    }
  }

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) redirect(`/shopping?w=${weekStart}`);

  await recalcQuantities(supabase, week.id);

  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, kroger_upc, order_qty, sent_qty")
    .eq("week_id", week.id)
    .eq("to_order", true)
    .not("kroger_upc", "is", null)
    .is("sent_at", null);
  // Only add what the cart does not have yet. Something already in the cart in full needs nothing more.
  const covered = (items ?? []).filter((i) => i.order_qty - i.sent_qty <= 0);
  if (covered.length) {
    await supabase
      .from("shopping_items")
      .update({ sent_at: new Date().toISOString() })
      .in("id", covered.map((i) => i.id));
  }
  const toAdd = (items ?? []).filter((i) => i.order_qty - i.sent_qty > 0);
  if (!toAdd.length) redirect(back("nothing"));

  let failure: "expired" | "cartfail" | null = null;
  try {
    await addToCart(
      token,
      toAdd.map((i) => ({ upc: i.kroger_upc as string, quantity: i.order_qty - i.sent_qty }))
    );
  } catch (e) {
    // 401/403 means Kroger no longer accepts our login. Anything else is a problem with the request.
    failure = e instanceof KrogerError && (e.status === 401 || e.status === 403) ? "expired" : "cartfail";
  }
  // Nothing is marked as sent unless Kroger accepted the cart, so you can simply try again.
  if (failure) redirect(back(failure));

  const sentAt = new Date().toISOString();
  await Promise.all(
    toAdd.map((i) => supabase.from("shopping_items").update({ sent_at: sentAt, sent_qty: i.order_qty }).eq("id", i.id))
  );
  redirect(`${back("sent")}&n=${toAdd.length}`);
}
