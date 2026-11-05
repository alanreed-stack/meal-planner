import Link from "next/link";
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
import { Field, Input, Select } from "@/components/ui/field";
import { IconLink } from "@/components/ui/icon-link";
import { Menu } from "@/components/ui/menu";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { Removable, RemoveMenuItem } from "@/components/removable";
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

  // What can be sent to the Kroger cart right now: matched, checked, and not already sent.
  const sendable = list.filter((i) => i.to_order && i.kroger_upc && !i.sent_at);
  const sendTotal = sendable.reduce(
    (sum, i) => sum + (i.kroger_price != null ? Number(i.kroger_price) * i.order_qty : 0),
    0
  );
  const matchedCount = list.filter((i) => i.to_order && i.kroger_upc).length;
  const sendLabel = `Send ${sendable.length} item${sendable.length === 1 ? "" : "s"} to Kroger${
    sendTotal > 0 ? ` · about $${sendTotal.toFixed(2)}` : ""
  }`;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <IconLink href={`/shopping?w=${addDays(monday, -7)}`} label="Previous week">
            <ChevronLeft aria-hidden className="size-5" />
          </IconLink>
          <h1 className="text-xl font-bold tabular-nums">{weekLabel(monday)}</h1>
          <IconLink href={`/shopping?w=${addDays(monday, 7)}`} label="Next week">
            <ChevronRight aria-hidden className="size-5" />
          </IconLink>
        </div>

        <KrogerFlash status={kroger} n={n} week={monday} />
        {connExpired && kroger !== "expired" && (
          <Notice
            tone="warning"
            className="mb-4"
            action={
              <ButtonAnchor href={`/api/kroger/connect?w=${monday}`} variant="secondary" size="sm">
                Reconnect Kroger
              </ButtonAnchor>
            }
          >
            Your Kroger connection expired. Reconnect before you send your list.
          </Notice>
        )}

        {/* 1. The week at a glance, and the one button that builds the list. */}
        <Card as="section" className="mb-5 space-y-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dd className="text-2xl font-bold tabular-nums">{mealCount ?? 0}</dd>
              <dt className="text-xs text-muted">Meals planned</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold tabular-nums">
                {toOrder}
                <span className="text-base font-normal text-muted"> / {list.length}</span>
              </dd>
              <dt className="text-xs text-muted">Items to order</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold tabular-nums">{priced.length > 0 ? `$${total.toFixed(2)}` : "—"}</dd>
              <dt className="text-xs text-muted">Estimated total</dt>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <form action={generateList}>
              <input type="hidden" name="week" value={monday} />
              <SubmitButton variant={list.length ? "secondary" : "primary"}>
                {list.length ? "Rebuild list" : "Build list from this week's meals"}
              </SubmitButton>
            </form>
            {list.length > 0 && (
              <ButtonLink href={`/shopping/store?w=${monday}`}>In-store checklist</ButtonLink>
            )}
          </div>
          {list.length > 0 && (
            <p className="text-xs text-muted">
              Checked items get ordered. Uncheck what you already have. Rebuilding keeps your checkboxes and anything you
              added.
              {priced.length > 0 &&
                ` The total is Kroger's price per package times how many you're buying${
                  unpriced > 0 ? `, and leaves out ${unpriced} item${unpriced === 1 ? "" : "s"} with no match yet` : ""
                }. Tax, fees and substitutions aren't included.`}
            </p>
          )}
        </Card>

        {/* 2. The list. */}
        {groups.map((g) => (
          <section key={g.category} className="mb-5 not-has-[li]:hidden">
            <SectionHeader className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">
              {g.category} · {g.rows.length}
            </SectionHeader>
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
                const buyNote = i.order_qty_manual
                  ? `${needText ? needText + " · " : ""}you set ${i.order_qty}`
                  : pack?.note || `Buying ${i.order_qty}`;
                return (
                  <Removable
                    key={i.id}
                    id={i.id}
                    label={i.name}
                    action={deleteItem}
                    className="px-3 py-1 text-sm"
                  >
                    {/* Line 1: tick box, the item, a tag if you added it, and the ⋯ menu. */}
                    <div className="flex items-center gap-1">
                      <OrderToggle id={i.id} checked={i.to_order} text={formatIngredient(qty, i.unit, i.name)} />
                      <span className="ml-auto flex items-center gap-1">
                        {i.manual && <Badge>added</Badge>}
                        <Menu label={`More for ${i.name}`} title={i.name}>
                          <div className="space-y-5 text-sm">
                            <div>
                              <p className="font-medium">What&apos;s this for?</p>
                              <p className="text-muted">
                                {uses.length
                                  ? uses.join(", ")
                                  : i.manual
                                    ? "You added this yourself."
                                    : "No planned meal uses this now."}
                              </p>
                              {similar && <p className="mt-1 text-muted">Similar to {similar} on this list.</p>}
                            </div>

                            {hasStore && (
                              <ButtonLink href={`/shopping/match/${i.id}`} className="w-full">
                                {i.kroger_upc ? "Change Kroger product" : "Find a Kroger product"}
                              </ButtonLink>
                            )}

                            {hasStore && i.kroger_upc && (
                              <form action={setQty} className="space-y-2">
                                <input type="hidden" name="id" value={i.id} />
                                <Field label="Packages to buy" hint={`${buyNote}. Leave empty for automatic.`}>
                                  <Input
                                    name="qty"
                                    type="number"
                                    min={1}
                                    max={50}
                                    defaultValue={i.order_qty_manual ? i.order_qty : ""}
                                    placeholder={String(i.order_qty)}
                                  />
                                </Field>
                                <SubmitButton className="w-full" data-menu-close>
                                  Save
                                </SubmitButton>
                              </form>
                            )}

                            {isStaple ? (
                              <p className="text-muted">On your &ldquo;things we always have&rdquo; list.</p>
                            ) : (
                              <form action={addStaple}>
                                <input type="hidden" name="name" value={i.name} />
                                <input type="hidden" name="item_id" value={i.id} />
                                <SubmitButton className="w-full" data-menu-close>
                                  We always have this
                                </SubmitButton>
                              </form>
                            )}

                            <RemoveMenuItem label={`Delete ${i.name}`} />
                          </div>
                        </Menu>
                      </span>
                    </div>

                    {/* Line 2, only when it matters: what Kroger product it matched, and anything to double-check. */}
                    {hasStore && i.to_order && (
                      <div className="ml-12 flex flex-wrap items-center gap-x-2 gap-y-1 pb-2 text-muted">
                        {i.kroger_upc ? (
                          <span title={i.kroger_description ?? ""} className="min-w-0 tabular-nums">
                            {i.kroger_description}
                            {i.kroger_price != null && (
                              <>
                                {" "}
                                · ${Number(i.kroger_price).toFixed(2)}
                                {i.order_qty > 1 ? ` × ${i.order_qty}` : ""}
                              </>
                            )}
                          </span>
                        ) : (
                          <span>
                            No Kroger match yet ·{" "}
                            <Link href={`/shopping/match/${i.id}`} className="text-primary-ink underline">
                              Find
                            </Link>
                          </span>
                        )}
                        {i.match_confidence === "low" && <Badge tone="warning">low confidence</Badge>}
                        {i.kroger_upc && !i.order_qty_manual && pack?.flag && (
                          <Badge tone="warning">check quantity</Badge>
                        )}
                        {i.sent_at && <Badge tone="success">in cart</Badge>}
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

        {/* Add something by hand: just a name and Add. Amount, unit and aisle are optional. */}
        <form action={addItem} className={cardStyles("default", true, "mb-5 space-y-3 text-sm")}>
          <input type="hidden" name="week" value={monday} />
          <div className="flex gap-2">
            <Input
              name="name"
              required
              placeholder="Add an item (milk, paper towels…)"
              aria-label="Item name"
              className="min-w-0 flex-1"
            />
            <SubmitButton variant="primary">Add</SubmitButton>
          </div>
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-muted hover:text-foreground">
              More: amount, unit, aisle
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Amount">
                <Input name="qty" type="number" step="any" min="0" placeholder="e.g. 2" />
              </Field>
              <Field label="Unit">
                <Input name="unit" placeholder="e.g. lb" />
              </Field>
              <Field label="Aisle" className="col-span-2 sm:col-span-1">
                <Select name="category" defaultValue="auto">
                  <option value="auto">Auto (from the name)</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </details>
        </form>

        {/* 3. Kroger: a short status card. The list above is what you came for. */}
        <Card as="section" className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Kroger</h2>
            <Badge tone={conn ? "success" : "neutral"}>{conn ? "connected" : "not connected"}</Badge>
            <span className="flex-1" />
            <ButtonAnchor href={`/api/kroger/connect?w=${monday}`} variant="ghost" size="sm">
              {conn ? "Reconnect" : "Connect"}
            </ButtonAnchor>
          </div>

          {hasStore ? (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="text-muted">Store: </span>
                {hh?.kroger_store_name}
              </span>
              <form action={clearStore}>
                <SubmitButton variant="ghost" size="sm">
                  Change store
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-muted">Pick your store so we can find real products and prices.</p>
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

          {hasStore && (
            <div className="flex flex-wrap gap-2">
              {list.length > 0 && (
                <form action={matchItems}>
                  <input type="hidden" name="week" value={monday} />
                  <SubmitButton>Match items</SubmitButton>
                </form>
              )}
              <ButtonAnchor href="https://www.kroger.com/cart" target="_blank" rel="noreferrer">
                Open Kroger cart <ExternalLink aria-hidden className="size-4" />
              </ButtonAnchor>
              {/* On a computer the send button lives here; on a phone it's the bar at the bottom. */}
              {sendable.length > 0 && conn && (
                <form action={sendToCart} className="hidden md:block">
                  <input type="hidden" name="week" value={monday} />
                  <SubmitButton variant="primary">{sendLabel}</SubmitButton>
                </form>
              )}
            </div>
          )}
        </Card>
      </main>

      {/* Phones: one thumb-reach button above the tab bar. Hidden until a store is chosen. */}
      {hasStore && list.length > 0 && (
        <div
          data-actionbar
          className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 p-2 backdrop-blur md:hidden"
        >
          {!conn ? (
            <ButtonAnchor
              href={`/api/kroger/connect?w=${monday}`}
              variant="primary"
              size="lg"
              className="w-full"
            >
              Connect Kroger to send your list
            </ButtonAnchor>
          ) : matchedCount === 0 ? (
            <form action={matchItems}>
              <input type="hidden" name="week" value={monday} />
              <SubmitButton variant="primary" size="lg" className="w-full">
                Match items first
              </SubmitButton>
            </form>
          ) : sendable.length > 0 ? (
            <form action={sendToCart}>
              <input type="hidden" name="week" value={monday} />
              <SubmitButton variant="primary" size="lg" className="w-full">
                {sendLabel}
              </SubmitButton>
            </form>
          ) : (
            <ButtonAnchor href="https://www.kroger.com/cart" target="_blank" rel="noreferrer" size="lg" className="w-full">
              All sent. Open Kroger cart <ExternalLink aria-hidden className="size-4" />
            </ButtonAnchor>
          )}
        </div>
      )}
    </>
  );
}
