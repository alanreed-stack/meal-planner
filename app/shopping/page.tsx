import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, isPast, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { addItem, deleteItem, generateList } from "./actions";
import { clearStore, matchItems, sendToCart, setQty, setStore } from "./kroger-actions";
import { searchStores, type Store } from "@/lib/kroger";
import { formatAmount, formatIngredient } from "@/lib/format";
import { packagesNeeded } from "@/lib/packaging";
import { similarTo } from "@/lib/similar";
import { splitOptions } from "@/lib/match";
import { addStaple } from "../settings/actions";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, ExternalLink, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, SectionHeader, cardStyles } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { Removable, RemoveTrigger } from "@/components/removable";
import { KrogerFlash, OrderToggle } from "./controls";

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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ButtonLink href={`/shopping?w=${addDays(monday, -7)}`} variant="secondary" aria-label="Previous week" className="px-3">
            <ChevronLeft aria-hidden className="size-5" />
          </ButtonLink>
          <h1 className="text-xl font-bold tabular-nums">Shopping: {weekLabel(monday)}</h1>
          <ButtonLink href={`/shopping?w=${addDays(monday, 7)}`} variant="secondary" aria-label="Next week" className="px-3">
            <ChevronRight aria-hidden className="size-5" />
          </ButtonLink>
        </div>

        <Card className="mb-5 flex flex-wrap items-center gap-3 text-sm">
          <form action={generateList}>
            <input type="hidden" name="week" value={monday} />
            <SubmitButton variant="primary">
              {list.length ? "Rebuild from this week's meals" : "Build list from this week's meals"}
            </SubmitButton>
          </form>
          <span className="text-muted tabular-nums">
            {mealCount ?? 0} planned meal{mealCount === 1 ? "" : "s"} · {toOrder} of {list.length} items to
            order
            {priced.length > 0 && ` · about $${total.toFixed(2)}`}
          </span>
          {list.length > 0 && (
            <ButtonLink href={`/shopping/store?w=${monday}`} className="ml-auto">
              In-store checklist
            </ButtonLink>
          )}
        </Card>
        {list.length > 0 && (
          <p className="mb-4 text-xs text-muted">
            Checked items will be ordered. Uncheck anything you already have. Rebuilding keeps your
            checkboxes and the items you added yourself.
          </p>
        )}

        <Card as="section" className="mb-5 space-y-3 text-sm">
          <h2 className="font-semibold">Kroger</h2>
          <KrogerFlash status={kroger} n={n} week={monday} />
          {connExpired && kroger !== "expired" && (
            <Notice
              tone="warning"
              action={
                <ButtonAnchor href={`/api/kroger/connect?w=${monday}`} variant="secondary" size="sm">
                  Reconnect Kroger
                </ButtonAnchor>
              }
            >
              Your Kroger connection expired. Reconnect before you send your list.
            </Notice>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2">
              Account: <Badge tone={conn ? "success" : "neutral"}>{conn ? "connected" : "not connected"}</Badge>
            </span>
            <ButtonAnchor href="https://www.kroger.com/cart" target="_blank" rel="noreferrer">
              Open Kroger cart <ExternalLink aria-hidden className="size-4" />
            </ButtonAnchor>
            <ButtonAnchor href={`/api/kroger/connect?w=${monday}`}>
              {conn ? "Reconnect" : "Connect Kroger"}
            </ButtonAnchor>
          </div>

          <div>
            {hasStore ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>Store: {hh?.kroger_store_name}</span>
                <form action={clearStore}>
                  <SubmitButton variant="ghost" size="sm">
                    change
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <div>
                <form className="mb-2 flex items-center gap-2">
                  <input type="hidden" name="w" value={monday} />
                  <label htmlFor="zip">Stores near</label>
                  <Input id="zip" name="zip" defaultValue={zip} className="w-28" />
                  <Button type="submit">Search</Button>
                </form>
                {storeError && <Notice tone="error">Store lookup failed. Try again.</Notice>}
                <ul className="divide-y divide-border rounded-md border border-border">
                  {stores.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-2 py-2">
                      <span className="flex-1">
                        {s.name}
                        <span className="block text-xs text-muted">{s.address}</span>
                      </span>
                      <form action={setStore}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="name" value={`${s.name} (${s.address})`} />
                        <SubmitButton variant="primary">Use this store</SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {hasStore && list.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <form action={matchItems}>
                <input type="hidden" name="week" value={monday} />
                <SubmitButton>Match items to Kroger products</SubmitButton>
              </form>
              <form action={sendToCart}>
                <input type="hidden" name="week" value={monday} />
                <SubmitButton variant="primary">Send checked items to Kroger cart</SubmitButton>
              </form>
              {priced.length > 0 && (
                <p className="w-full text-xs text-muted tabular-nums">
                  Estimated total <b>${total.toFixed(2)}</b> for {priced.length} priced item
                  {priced.length === 1 ? "" : "s"}
                  {unpriced > 0 ? `, plus ${unpriced} with no match yet` : ""}. Kroger&apos;s price per package
                  times how many you&apos;re buying. Tax, fees and substitutions aren&apos;t included.
                </p>
              )}
            </div>
          )}
        </Card>

        {groups.map((g) => (
          <section key={g.category} className="mb-5 not-has-[li]:hidden">
            <SectionHeader className="mb-1">{g.category}</SectionHeader>
            <Card as="ul" padded={false} className="divide-y divide-border">
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
                  <Removable
                    key={i.id}
                    id={i.id}
                    label={i.name}
                    action={deleteItem}
                    className="px-3 py-1 text-sm"
                  >
                    <div className="flex items-center gap-1">
                      <OrderToggle id={i.id} checked={i.to_order} text={formatIngredient(qty, i.unit, i.name)} />
                      {i.manual && <Badge className="ml-1">added</Badge>}
                      <span className="ml-auto">
                        <RemoveTrigger label={`Delete ${i.name}`} />
                      </span>
                    </div>
                    {similar && <p className="ml-12 text-xs text-muted">similar to {similar}</p>}
                    <details className="ml-12 text-xs text-muted">
                      <summary className="min-h-8 cursor-pointer py-1 hover:text-foreground">
                        {uses.length
                          ? `for ${uses.length} meal${uses.length === 1 ? "" : "s"}`
                          : i.manual
                            ? "added by hand"
                            : "what's this for?"}
                        {isStaple && " · we always have this"}
                      </summary>
                      <div className="mt-1 space-y-1 pb-2">
                        {uses.length > 0 ? (
                          <p>{uses.join(", ")}</p>
                        ) : (
                          <p>{i.manual ? "You added this yourself." : "No planned meal uses this now."}</p>
                        )}
                        {!isStaple && (
                          <form action={addStaple}>
                            <input type="hidden" name="name" value={i.name} />
                            <input type="hidden" name="item_id" value={i.id} />
                            <SubmitButton size="sm">We always have this</SubmitButton>
                          </form>
                        )}
                      </div>
                    </details>
                    {hasStore && i.to_order && (
                      <div className="ml-12 space-y-1 pb-2 text-xs text-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          {i.kroger_upc ? (
                            <span title={i.kroger_description ?? ""} className="tabular-nums">
                              → {i.kroger_description}
                              {i.kroger_price
                                ? ` ($${Number(i.kroger_price).toFixed(2)}${i.order_qty > 1 ? ` × ${i.order_qty}` : ""})`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-warning-ink">no Kroger match yet</span>
                          )}
                          {i.match_confidence === "low" && (
                            <Badge tone="warning">low confidence, check this</Badge>
                          )}
                          <ButtonLink href={`/shopping/match/${i.id}`} variant="ghost" size="sm">
                            {i.kroger_upc ? "change" : "find"}
                          </ButtonLink>
                        </div>
                        {i.kroger_upc && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tabular-nums">
                              {i.order_qty_manual
                                ? `${needText ? needText + " · " : ""}you set ${i.order_qty}`
                                : pack?.note || `Buying ${i.order_qty}`}
                            </span>
                            {!i.order_qty_manual && pack?.flag && <Badge tone="warning">check quantity</Badge>}
                            <form action={setQty} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={i.id} />
                              <Input
                                name="qty"
                                type="number"
                                min={1}
                                max={50}
                                defaultValue={i.order_qty_manual ? i.order_qty : ""}
                                placeholder={String(i.order_qty)}
                                className="w-20"
                                aria-label="Packages to buy (empty for automatic)"
                              />
                              <SubmitButton variant="ghost" size="sm">
                                set
                              </SubmitButton>
                            </form>
                            {i.sent_at && <Badge tone="success">in cart</Badge>}
                          </div>
                        )}
                      </div>
                    )}
                  </Removable>
                );
              })}
            </Card>
          </section>
        ))}

        {list.length === 0 && (
          <EmptyState
            icon={<ShoppingCart aria-hidden className="size-8" />}
            title="No list yet"
            className="mb-5"
            action={
              (mealCount ?? 0) === 0 ? (
                <ButtonLink href={`/plan?w=${monday}`} variant="primary">
                  Plan this week
                </ButtonLink>
              ) : undefined
            }
          >
            {(mealCount ?? 0) > 0
              ? "You have meals planned. Tap “Build list from this week's meals” above."
              : "Plan some dinners first, then the list builds itself from them."}
          </EmptyState>
        )}

        <form action={addItem} className={cardStyles("default", true, "flex flex-wrap gap-2 text-sm")}>
          <input type="hidden" name="week" value={monday} />
          <Input
            name="name"
            required
            placeholder="Add an item (milk, paper towels…)"
            aria-label="Item name"
            className="min-w-0 flex-1"
          />
          <Input name="qty" type="number" step="any" min="0" placeholder="Qty" aria-label="Quantity" className="w-20" />
          <Input name="unit" placeholder="Unit" aria-label="Unit" className="w-24" />
          <Select name="category" defaultValue="other" aria-label="Aisle" className="w-auto">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <SubmitButton variant="primary">Add</SubmitButton>
        </form>
      </main>
    </>
  );
}
