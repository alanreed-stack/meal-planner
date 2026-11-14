import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { KIND_LABEL } from "@/lib/meal-kinds";
import { addDays, hourET, weekStartOf, todayET, weekLabel, weekRelation } from "@/lib/dates";
import { groceryFocus, shouldPlanNextWeek } from "@/lib/home-week";
import { clockBefore, formatMinutes } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { CalendarPlus, ChefHat, ChevronRight, Clock, ShoppingCart } from "lucide-react";
import { RecipeTile } from "@/app/recipes/recipe-tile";
import { mainProtein } from "@/lib/protein";


export default async function Home() {
  const { supabase, householdId, displayName } = await requireHousehold();
  const today = todayET();
  const weekStart = weekStartOf(today);
  const h = hourET();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const nextWeekStart = addDays(weekStart, 7);

  const [{ data: hh }, { data: meals }, { data: weekRows }] = await Promise.all([
    supabase.from("households").select("default_protein_lbs, dinner_time").eq("id", householdId).single(),
    supabase
      .from("planned_meals")
      .select("id, day, kind, recipe_id, protein_lbs, recipes(name, prep_minutes, cook_minutes, image_url, ingredients:recipe_ingredients(name, qty, unit, category))")
      .eq("slot", "dinner")
      .gte("day", today)
      .lte("day", addDays(today, 4))
      .order("day"),
    supabase
      .from("weeks")
      .select("id, week_start")
      .eq("household_id", householdId)
      .in("week_start", [weekStart, nextWeekStart]),
  ]);
  const weekId = (start: string) => (weekRows ?? []).find((w) => w.week_start === start)?.id;
  const nextWeekId = weekId(nextWeekStart);
  const ids = (weekRows ?? []).map((w) => w.id);
  const [{ data: items }, { count: nextDinners }] = await Promise.all([
    ids.length
      ? supabase.from("shopping_items").select("week_id, to_order, sent_at").in("week_id", ids)
      : Promise.resolve({ data: [] }),
    nextWeekId
      ? supabase.from("planned_meals").select("id", { count: "exact", head: true }).eq("week_id", nextWeekId).eq("slot", "dinner")
      : Promise.resolve({ count: 0 }),
  ]);

  const dinnerTime = String(hh?.dinner_time ?? "18:00:00");
  const defaultLbs = Number(hh?.default_protein_lbs ?? 2);
  const all = meals ?? [];
  const tonight = all.filter((m) => m.day === today);
  const later = all.filter((m) => m.day !== today);

  // The Groceries card follows whichever week still has something to send: this week, then next week.
  const summary = (start: string) => {
    const id = weekId(start);
    const toOrder = (items ?? []).filter((i) => i.week_id === id && i.to_order);
    return { weekStart: start, toOrder: toOrder.length, inCart: toOrder.filter((i) => i.sent_at).length };
  };
  const groceries = groceryFocus([summary(weekStart), summary(nextWeekStart)]);
  const groceryWeek = weekRelation(groceries.weekStart, weekStart) ?? "This week";
  const planNext = shouldPlanNextWeek(today, nextDinners ?? 0);
  const dow = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold">
          {greeting}
          {displayName ? `, ${displayName}` : ""}
        </h1>

        {/* Tonight: the one thing most visits are about. */}
        <section aria-labelledby="tonight" className="overflow-hidden rounded-lg border-2 border-primary bg-primary-soft">
          <h2 id="tonight" className="px-4 pt-3 text-xs font-semibold tracking-wide text-primary-ink uppercase">
            Tonight
          </h2>
          {tonight.length === 0 && (
            <div className="px-4 pt-2 pb-4">
              <p className="text-lg">Nothing planned for dinner yet.</p>
              <ButtonLink href={`/plan?add=${today}`} variant="primary" className="mt-3">
                <CalendarPlus aria-hidden className="size-4" /> Plan tonight
              </ButtonLink>
            </div>
          )}
          <ul className="space-y-4 pb-4">
            {tonight.map((m) => {
              if (m.kind !== "recipe" || !m.recipes) {
                return (
                  <li key={m.id} className="px-4 pt-2 text-lg text-muted italic">
                    {KIND_LABEL[m.kind] ?? "Dinner"}
                  </li>
                );
              }
              const total = (m.recipes.prep_minutes ?? 0) + (m.recipes.cook_minutes ?? 0);
              const lbs = m.protein_lbs ?? defaultLbs;
              return (
                <li key={m.id}>
                  <div className="mt-2">
                    {m.recipes.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.recipes.image_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <RecipeTile protein={mainProtein(m.recipes.ingredients ?? [])} className="h-32 rounded-none" />
                    )}
                  </div>
                  <div className="px-4 pt-3">
                    <p className="text-xl font-semibold">{m.recipes.name}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden className="size-4" /> {formatMinutes(total)}
                      </span>
                      <span>
                        Start by <b className="text-primary-ink">{clockBefore(dinnerTime, total)}</b> for dinner at{" "}
                        {clockBefore(dinnerTime, 0)}
                      </span>
                    </p>
                    <div className="mt-3 flex gap-2">
                      <ButtonLink href={`/recipes/${m.recipe_id}/cook?lbs=${lbs}`} variant="primary" size="lg" className="flex-1">
                        <ChefHat aria-hidden className="size-5" /> Start cooking
                      </ButtonLink>
                      <ButtonLink href={`/recipes/${m.recipe_id}?lbs=${lbs}`} size="lg">
                        View recipe
                      </ButtonLink>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {later.length > 0 && (
          <Card as="section" aria-labelledby="coming-up" padded={false}>
            <div className="px-4 pt-3">
              <SectionHeader>
                <span id="coming-up">Coming up</span>
              </SectionHeader>
            </div>
            <ul className="mt-1 divide-y divide-border">
              {later.map((m) => (
                <li key={m.id}>
                  {m.kind === "recipe" && m.recipe_id ? (
                    <Link
                      href={`/recipes/${m.recipe_id}`}
                      className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="w-12 shrink-0 text-sm font-medium text-muted">{dow(m.day)}</span>
                      <span className="min-w-0 flex-1 truncate">{m.recipes?.name ?? "(deleted recipe)"}</span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
                      <span className="w-12 shrink-0 text-sm font-medium text-muted">{dow(m.day)}</span>
                      <span className="text-muted italic">{KIND_LABEL[m.kind] ?? "Dinner"}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {planNext && (
          <Card as="section" tone="accent" aria-labelledby="plan-next">
            <h2 id="plan-next" className="text-xs font-semibold tracking-wide text-primary-ink uppercase">
              Next week
            </h2>
            <p className="mt-2 text-lg">
              {nextDinners ? `Only ${nextDinners} dinner${nextDinners === 1 ? "" : "s"} planned so far.` : "Nothing is planned yet."}
            </p>
            <p className="text-sm text-muted">{weekLabel(nextWeekStart)}</p>
            <ButtonLink href={`/plan?w=${nextWeekStart}`} variant="primary" className="mt-3">
              <CalendarPlus aria-hidden className="size-4" /> Plan next week
            </ButtonLink>
          </Card>
        )}

        <Card as="section" aria-labelledby="groceries">
          <SectionHeader>
            <span id="groceries">Groceries</span>
          </SectionHeader>
          <p className="mt-1 text-sm text-muted">
            {groceryWeek} · {weekLabel(groceries.weekStart)}
          </p>
          {groceries.toOrder === 0 ? (
            <p className="mt-2 text-muted">No shopping list for this week yet.</p>
          ) : (
            <div className="mt-2">
              <p className="tabular-nums">
                <b>{groceries.inCart}</b> of {groceries.toOrder} in your Kroger cart
              </p>
              <div
                role="progressbar"
                aria-label="Items in Kroger cart"
                aria-valuemin={0}
                aria-valuemax={groceries.toOrder}
                aria-valuenow={groceries.inCart}
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((groceries.inCart / groceries.toOrder) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <ButtonLink href={`/shopping?w=${groceries.weekStart}`} className="mt-3">
            <ShoppingCart aria-hidden className="size-4" /> Open shopping list
          </ButtonLink>
        </Card>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/plan">Plan the week</ButtonLink>
          <ButtonLink href="/recipes/new">Add a recipe</ButtonLink>
        </div>
      </main>
    </>
  );
}
