import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, isPast, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { addItem, deleteItem, generateList, toggleItem } from "./actions";
import { clearStore, matchItems, sendToCart, setQty, setStore } from "./kroger-actions";
import { searchStores, type Store } from "@/lib/kroger";
import { formatAmount, formatIngredient } from "@/lib/format";
import { packagesNeeded } from "@/lib/packaging";
import { similarTo } from "@/lib/similar";
import { splitOptions } from "@/lib/match";
import { addStaple } from "../settings/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shopping" };

const CATEGORIES = ["produce", "meat", "dairy", "bakery", "frozen", "pantry", "other"];

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; kroger?: string; n?: string; zip?: string }>;
}) {
  const { w, kroger, n, zip = "30307" } = await searchParams;
  const monday = mondayOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayET());
  const { supabase, householdId } = await requireHousehold();

  const [{ data: hh }, { data: conn }] = await Promise.all([
    supabase
      .from("households")
      .select("kroger_location_id, kroger_store_name")
      .eq("id", householdId)
      .single(),
    supabase.from("kroger_connections").select("user_id, expires_at, refresh_token").maybeSingle(),
  ]);
  // Connected, but the saved login ran out and can't be renewed on its own.
  const connExpired =
    !!conn && isPast(conn.expires_at) && !conn.refresh_token;
  const hasStore = !!hh?.kroger_location_id;
  let stores: Store[] = [];
  let storeError = false;
  if (!hasStore) {
    try {
      stores = await searchStores(zip);
    } catch {
      storeError = true;
    }
  }

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", monday)
    .maybeSingle();

  const [{ data: items }, { count: mealCount }] = week
    ? await Promise.all([
        supabase
          .from("shopping_items")
          .select("id, name, qty, unit, category, to_order, manual, kroger_upc, kroger_description, kroger_price, kroger_size, match_confidence, order_qty, order_qty_manual, sent_at")
          .eq("week_id", week.id)
          .order("name"),
        supabase
          .from("planned_meals")
          .select("id", { count: "exact", head: true })
          .eq("week_id", week.id)
          .eq("kind", "recipe"),
      ])
    : [{ data: [] }, { count: 0 }];

  const list = items ?? [];
  const toOrder = list.filter((i) => i.to_order).length;

  // Estimated total for what is checked: Kroger's price for the matched product x packages to buy.
  const priced = list.filter((i) => i.to_order && i.kroger_upc && i.kroger_price != null);
  const total = priced.reduce((sum, i) => sum + Number(i.kroger_price) * i.order_qty, 0);
  const unpriced = toOrder - priced.length;

  // What each item is for: the planned recipes this week that use it.
  const { data: planned } = week
    ? await supabase
        .from("planned_meals")
        .select("day, recipe_id, recipes(name)")
        .eq("week_id", week.id)
        .eq("kind", "recipe")
        .not("recipe_id", "is", null)
        .order("day")
    : { data: [] };
  const plannedIds = [...new Set((planned ?? []).map((p) => p.recipe_id).filter(Boolean) as string[])];
  const { data: usedIngs } = plannedIds.length
    ? await supabase.from("recipe_ingredients").select("recipe_id, name").in("recipe_id", plannedIds)
    : { data: [] };
  const usedBy = (itemName: string) => {
    const k = itemName.trim().toLowerCase();
    const ids = new Set(
      (usedIngs ?? [])
        .filter(
          (u) =>
            u.name.trim().toLowerCase() === k ||
            splitOptions(u.name).some((o) => o.toLowerCase() === k)
        )
        .map((u) => u.recipe_id)
    );
    return (planned ?? [])
      .filter((p) => p.recipe_id && ids.has(p.recipe_id))
      .map((p) => {
        const name = (p.recipes as unknown as { name: string } | null)?.name ?? "a recipe";
        const dow = new Date(p.day + "T00:00:00Z").toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        });
        return `${name} (${dow})`;
      });
  };
  const { data: stapleRows } = await supabase
    .from("pantry_staples")
    .select("name_key")
    .eq("household_id", householdId);
  const staples = new Set((stapleRows ?? []).map((s) => s.name_key));
  const groups = CATEGORIES.map((c) => ({
    category: c,
    rows: list.filter((i) => (CATEGORIES.includes(i.category) ? i.category : "other") === c),
  })).filter((g) => g.rows.length);

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href={`/shopping?w=${addDays(monday, -7)}`} className="rounded border px-2 py-1">
            ←
          </Link>
          <h1 className="text-xl font-bold">Shopping: {weekLabel(monday)}</h1>
          <Link href={`/shopping?w=${addDays(monday, 7)}`} className="rounded border px-2 py-1">
            →
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm">
          <form action={generateList}>
            <input type="hidden" name="week" value={monday} />
            <button className="rounded bg-green-700 px-3 py-1.5 font-medium text-white">
              {list.length ? "Rebuild from this week's meals" : "Build list from this week's meals"}
            </button>
          </form>
          <span className="text-neutral-600">
            {mealCount ?? 0} planned meal{mealCount === 1 ? "" : "s"} · {toOrder} of {list.length} items to
            order
            {priced.length > 0 && ` · about $${total.toFixed(2)}`}
          </span>
          {list.length > 0 && (
            <Link href={`/shopping/store?w=${monday}`} className="ml-auto rounded border px-3 py-1.5">
              In-store checklist
            </Link>
          )}
        </div>
        {list.length > 0 && (
          <p className="mb-4 text-xs text-neutral-500">
            Checked items will be ordered. Uncheck anything you already have. Rebuilding keeps your
            checkboxes and the items you added yourself.
          </p>
        )}


        <section className="mb-5 rounded-xl border bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Kroger</h2>
          {kroger === "connected" && (
            <p className="mb-2 rounded bg-green-50 px-2 py-1">Connected to your Kroger account.</p>
          )}
          {kroger === "error" && (
            <p className="mb-2 rounded bg-red-50 px-2 py-1 text-red-700">
              Couldn&apos;t connect to Kroger. Please try again.
            </p>
          )}
          {kroger === "notconnected" && (
            <p className="mb-2 rounded bg-amber-50 px-2 py-1">Connect your Kroger account first.</p>
          )}
          {(kroger === "expired" || connExpired) && (
            <p className="mb-2 rounded bg-amber-50 px-2 py-1">
              Your Kroger connection expired, so nothing was sent. Nothing is lost.{" "}
              <a href={`/api/kroger/connect?w=${monday}`} className="font-medium underline">
                Reconnect Kroger
              </a>{" "}
              and try again.
            </p>
          )}
          {kroger === "nothing" && (
            <p className="mb-2 rounded bg-amber-50 px-2 py-1">
              Nothing new to send. Match some items first.
            </p>
          )}
          {kroger === "cartfail" && (
            <p className="mb-2 rounded bg-red-50 px-2 py-1 text-red-700">
              Kroger didn&apos;t accept the cart, and nothing was marked as sent. Your login is fine. Try again in
              a minute, and check any rows marked &ldquo;low confidence&rdquo; or &ldquo;check quantity&rdquo;.
            </p>
          )}
          {kroger === "sent" && (
            <p className="mb-2 rounded bg-green-50 px-2 py-1">
              Sent {n} item{n === "1" ? "" : "s"} to your Kroger cart.{" "}
              <a
                href="https://www.kroger.com/cart"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Open my Kroger cart
              </a>{" "}
              to review and check out.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span>Account: {conn ? "connected ✓" : "not connected"}</span>
            <a
              href="https://www.kroger.com/cart"
              target="_blank"
              rel="noreferrer"
              className="rounded border px-3 py-1"
            >
              Open Kroger cart ↗
            </a>
            <a href={`/api/kroger/connect?w=${monday}`} className="rounded border px-3 py-1">
              {conn ? "Reconnect" : "Connect Kroger"}
            </a>
          </div>

          <div className="mt-3">
            {hasStore ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>Store: {hh?.kroger_store_name}</span>
                <form action={clearStore}>
                  <button className="underline">change</button>
                </form>
              </div>
            ) : (
              <div>
                <form className="mb-2 flex items-center gap-2">
                  <input type="hidden" name="w" value={monday} />
                  <label>Stores near</label>
                  <input name="zip" defaultValue={zip} className="w-24 rounded border px-2 py-1" />
                  <button className="rounded border px-2 py-1">Search</button>
                </form>
                {storeError && <p className="text-red-700">Store lookup failed. Try again.</p>}
                <ul className="divide-y rounded border">
                  {stores.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
                      <span className="flex-1">
                        {s.name}
                        <span className="block text-xs text-neutral-500">{s.address}</span>
                      </span>
                      <form action={setStore}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="name" value={`${s.name} (${s.address})`} />
                        <button className="rounded bg-green-700 px-2 py-1 text-white">Use this store</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {hasStore && list.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={matchItems}>
                <input type="hidden" name="week" value={monday} />
                <button className="rounded border px-3 py-1.5">Match items to Kroger products</button>
              </form>
              <form action={sendToCart}>
                <input type="hidden" name="week" value={monday} />
                <button className="rounded bg-green-700 px-3 py-1.5 font-medium text-white">
                  Send checked items to Kroger cart
                </button>
              </form>
              {priced.length > 0 && (
                <p className="w-full text-xs text-neutral-600">
                  Estimated total <b>${total.toFixed(2)}</b> for {priced.length} priced item
                  {priced.length === 1 ? "" : "s"}
                  {unpriced > 0 ? `, plus ${unpriced} with no match yet` : ""}. Kroger&apos;s price per package
                  times how many you&apos;re buying. Tax, fees and substitutions aren&apos;t included.
                </p>
              )}
            </div>
          )}
        </section>

        {groups.map((g) => (
          <section key={g.category} className="mb-5">
            <h2 className="mb-1 text-sm font-semibold uppercase text-neutral-500">{g.category}</h2>
            <ul className="divide-y rounded-xl border bg-white">
              {g.rows.map((i) => {
                const qty = i.qty == null ? null : Number(i.qty);
                const pack = i.kroger_upc
                  ? packagesNeeded({ qty, unit: i.unit, name: i.name }, i.kroger_size)
                  : null;
                const similar = similarTo(i, list);
                const uses = usedBy(i.name);
                const isStaple = staples.has(i.name.trim().toLowerCase());
                const needText = qty != null ? `Need ${formatAmount(qty, i.unit)}` : "";
                return (
                  <li key={i.id} className="px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <form action={toggleItem}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="to_order" value={String(i.to_order)} />
                        <button
                          aria-label={i.to_order ? "Don't order" : "Order"}
                          className={`h-8 w-8 rounded border text-sm ${
                            i.to_order ? "bg-green-700 text-white" : "bg-white"
                          }`}
                        >
                          {i.to_order ? "✓" : ""}
                        </button>
                      </form>
                      <span className={i.to_order ? "" : "text-neutral-400 line-through"}>
                        {formatIngredient(qty, i.unit, i.name)}
                      </span>
                      {i.manual && <span className="rounded bg-neutral-100 px-1.5 text-xs">added</span>}
                      <form action={deleteItem} className="ml-auto">
                        <input type="hidden" name="id" value={i.id} />
                        <button aria-label="Delete" className="px-2 py-1.5 text-neutral-400 hover:text-red-700">
                          ✕
                        </button>
                      </form>
                    </div>
                    {similar && (
                      <p className="ml-9 mt-0.5 text-xs text-neutral-500">similar to {similar}</p>
                    )}
                    <details className="ml-9 mt-0.5 text-xs text-neutral-600">
                      <summary className="cursor-pointer text-neutral-500 hover:text-neutral-800">
                        {uses.length
                          ? `for ${uses.length} meal${uses.length === 1 ? "" : "s"}`
                          : i.manual
                            ? "added by hand"
                            : "what's this for?"}
                        {isStaple && " · we always have this"}
                      </summary>
                      <div className="mt-1 space-y-1">
                        {uses.length > 0 ? (
                          <p>{uses.join(", ")}</p>
                        ) : (
                          <p>{i.manual ? "You added this yourself." : "No planned meal uses this now."}</p>
                        )}
                        {!isStaple && (
                          <form action={addStaple}>
                            <input type="hidden" name="name" value={i.name} />
                            <input type="hidden" name="item_id" value={i.id} />
                            <button className="underline">We always have this</button>
                          </form>
                        )}
                      </div>
                    </details>
                    {hasStore && i.to_order && (
                      <div className="ml-9 mt-1 space-y-1 text-xs text-neutral-600">
                        <div className="flex flex-wrap items-center gap-2">
                          {i.kroger_upc ? (
                            <span title={i.kroger_description ?? ""}>
                              → {i.kroger_description}
                              {i.kroger_price
                                ? ` ($${Number(i.kroger_price).toFixed(2)}${i.order_qty > 1 ? ` × ${i.order_qty}` : ""})`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-amber-700">no Kroger match yet</span>
                          )}
                          {i.match_confidence === "low" && (
                            <span className="rounded bg-amber-100 px-1.5 text-amber-800">
                              low confidence, check this
                            </span>
                          )}
                          <Link href={`/shopping/match/${i.id}`} className="underline">
                            {i.kroger_upc ? "change" : "find"}
                          </Link>
                        </div>
                        {i.kroger_upc && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              {i.order_qty_manual
                                ? `${needText ? needText + " · " : ""}you set ${i.order_qty}`
                                : pack?.note || `Buying ${i.order_qty}`}
                            </span>
                            {!i.order_qty_manual && pack?.flag && (
                              <span className="rounded bg-amber-100 px-1.5 text-amber-800">
                                check quantity
                              </span>
                            )}
                            <form action={setQty} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={i.id} />
                              <input
                                name="qty"
                                type="number"
                                min={1}
                                max={50}
                                defaultValue={i.order_qty_manual ? i.order_qty : ""}
                                placeholder={String(i.order_qty)}
                                className="w-12 rounded border px-1 py-0.5"
                                aria-label="Packages to buy (empty for automatic)"
                              />
                              <button className="underline">set</button>
                            </form>
                            {i.sent_at && <span className="rounded bg-green-100 px-1.5">in cart</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {list.length === 0 && (
          <div className="mb-5 rounded-xl border border-dashed bg-white p-6 text-center">
            <p className="text-lg font-semibold">No list yet</p>
            <p className="mt-1 text-sm text-neutral-600">
              {(mealCount ?? 0) > 0
                ? "You have meals planned. Tap “Build list from this week's meals” above."
                : "Plan some dinners first, then the list builds itself from them."}
            </p>
            {(mealCount ?? 0) === 0 && (
              <Link href={`/plan?w=${monday}`} className="mt-3 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm text-white">
                Plan this week
              </Link>
            )}
          </div>
        )}

        <form action={addItem} className="flex flex-wrap gap-2 rounded-xl border bg-white p-4 text-sm">
          <input type="hidden" name="week" value={monday} />
          <input name="name" required placeholder="Add an item (milk, paper towels…)" className="w-full min-w-0 flex-1 rounded border px-2 py-1" />
          <input name="qty" type="number" step="any" min="0" placeholder="Qty" className="w-16 rounded border px-2 py-1" />
          <input name="unit" placeholder="Unit" className="w-20 rounded border px-2 py-1" />
          <select name="category" defaultValue="other" className="rounded border px-2 py-1">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="rounded bg-green-700 px-3 py-1 text-white">Add</button>
        </form>
      </main>
    </>
  );
}
