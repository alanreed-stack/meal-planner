import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { addItem, deleteItem, generateList, toggleItem } from "./actions";
import { clearStore, matchItems, sendToCart, setQty, setStore } from "./kroger-actions";
import { searchStores, type Store } from "@/lib/kroger";
import { formatAmount, formatIngredient } from "@/lib/format";
import { packagesNeeded } from "@/lib/packaging";
import { similarTo } from "@/lib/similar";
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
  const { supabase, householdId, inviteCode } = await requireHousehold();

  const [{ data: hh }, { data: conn }] = await Promise.all([
    supabase
      .from("households")
      .select("kroger_location_id, kroger_store_name")
      .eq("id", householdId)
      .single(),
    supabase.from("kroger_connections").select("user_id").maybeSingle(),
  ]);
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
          .eq("week_id", week.id),
      ])
    : [{ data: [] }, { count: 0 }];

  const list = items ?? [];
  const toOrder = list.filter((i) => i.to_order).length;
  const groups = CATEGORIES.map((c) => ({
    category: c,
    rows: list.filter((i) => (CATEGORIES.includes(i.category) ? i.category : "other") === c),
  })).filter((g) => g.rows.length);

  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
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
          </span>
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
          {kroger === "nothing" && (
            <p className="mb-2 rounded bg-amber-50 px-2 py-1">
              Nothing new to send. Match some items first.
            </p>
          )}
          {kroger === "cartfail" && (
            <p className="mb-2 rounded bg-red-50 px-2 py-1 text-red-700">
              Kroger wouldn&apos;t take the cart. Try reconnecting.
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
            <a href="/api/kroger/connect" className="rounded border px-3 py-1">
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
                const needText = qty != null ? `Need ${formatAmount(qty, i.unit)}` : "";
                return (
                  <li key={i.id} className="px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <form action={toggleItem}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="to_order" value={String(i.to_order)} />
                        <button
                          aria-label={i.to_order ? "Don't order" : "Order"}
                          className={`h-6 w-6 rounded border text-xs ${
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
                        <button aria-label="Delete" className="text-neutral-400 hover:text-red-700">
                          ✕
                        </button>
                      </form>
                    </div>
                    {similar && (
                      <p className="ml-9 mt-0.5 text-xs text-neutral-500">similar to {similar}</p>
                    )}
                    {hasStore && i.to_order && (
                      <div className="ml-9 mt-1 space-y-1 text-xs text-neutral-600">
                        <div className="flex flex-wrap items-center gap-2">
                          {i.kroger_upc ? (
                            <span title={i.kroger_description ?? ""}>
                              → {i.kroger_description}
                              {i.kroger_price ? ` ($${Number(i.kroger_price).toFixed(2)})` : ""}
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
          <p className="mb-5 text-neutral-500">
            Nothing here yet. Plan some meals on the This week page, then build the list.
          </p>
        )}

        <form action={addItem} className="flex flex-wrap gap-2 rounded-xl border bg-white p-4 text-sm">
          <input type="hidden" name="week" value={monday} />
          <input name="name" required placeholder="Add an item (milk, paper towels…)" className="min-w-0 flex-1 rounded border px-2 py-1" />
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
