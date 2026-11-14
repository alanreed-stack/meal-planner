import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { KIND_LABEL } from "@/lib/meal-kinds";
import { addDays, hourET, weekStartOf, todayET, weekLabel, weekRelation } from "@/lib/dates";
import { groceryFocus, quickPicks, shouldPlanNextWeek, weekStatus } from "@/lib/home-week";
import { gettingStarted } from "@/lib/getting-started";
import { headsUp } from "@/lib/heads-up";
import { clockBefore, formatMinutes } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { FormBusy } from "@/components/ui/form-busy";
import { Notice } from "@/components/ui/notice";
import { RowButton } from "@/components/ui/row-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { addMeal } from "@/app/plan/actions";
import { RateRow } from "@/app/plan/rate-row";
import { Card, SectionHeader } from "@/components/ui/card";
import { CalendarPlus, CheckCircle2, ChefHat, ChevronRight, Circle, Clock, Plus, ShoppingCart, Star } from "lucide-react";
import { RecipeTile } from "@/app/recipes/recipe-tile";
import { mainProtein } from "@/lib/protein";


const startLinks: Record<string, string> = {
  recipes: "/recipes",
  plan: "/plan",
  store: "/shopping#kroger",
  kroger: "/shopping#kroger",
  staples: "/settings#staples",
};

/** A small recipe picture for a list row: the photo if there is one, else the colored tile. */
function Thumb({ image, protein }: { image: string | null; protein: string }) {
  if (!image) return <RecipeTile compact protein={protein} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-md object-cover" />;
}

export default async function Home() {
  const { supabase, householdId, displayName } = await requireHousehold();
  const today = todayET();
  const weekStart = weekStartOf(today);
  const h = hourET();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const nextWeekStart = addDays(weekStart, 7);

  const [{ data: hh }, { data: meals }, { data: weekRows }] = await Promise.all([
    supabase.from("households").select("default_protein_lbs, dinner_time, kroger_location_id, thaw_reminder").eq("id", householdId).single(),
    supabase
      .from("planned_meals")
      .select("id, day, kind, recipe_id, protein_lbs, recipes(name, tags, prep_minutes, cook_minutes, image_url, ingredients:recipe_ingredients(name, qty, unit, category))")
      .eq("slot", "dinner")
      .gte("day", today)
      .lte("day", addDays(today, 4))
      .order("day"),
    supabase
      .from("weeks")
      .select("id, week_start, mode, list_built_at")
      .eq("household_id", householdId)
      .in("week_start", [weekStart, nextWeekStart]),
  ]);
  const weekId = (start: string) => (weekRows ?? []).find((w) => w.week_start === start)?.id;
  const nextWeekId = weekId(nextWeekStart);
  const ids = (weekRows ?? []).map((w) => w.id);
  const thisWeek = (weekRows ?? []).find((w) => w.week_start === weekStart);
  const [{ data: items }, { count: nextDinners }, { count: weekDinners }, { data: toRate }, { count: recipeCount }, { count: stapleCount }, { data: krogerRow }] =
    await Promise.all([
    ids.length
      ? supabase.from("shopping_items").select("week_id, to_order, sent_at").in("week_id", ids)
      : Promise.resolve({ data: [] }),
    nextWeekId
      ? supabase.from("planned_meals").select("id", { count: "exact", head: true }).eq("week_id", nextWeekId).eq("slot", "dinner")
      : Promise.resolve({ count: 0 }),
    thisWeek
      ? supabase.from("planned_meals").select("id", { count: "exact", head: true }).eq("week_id", thisWeek.id).eq("slot", "dinner")
      : Promise.resolve({ count: 0 }),
    // Dinners from the past week that nobody has rated yet.
    supabase
      .from("planned_meals")
      .select("id, day, recipes(name)")
      .eq("kind", "recipe")
      .eq("slot", "dinner")
      .is("rating", null)
      .not("recipe_id", "is", null)
      .gte("day", addDays(today, -7))
      .lt("day", today)
      .order("day", { ascending: false }),
    supabase.from("recipes").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("pantry_staples").select("name_key", { count: "exact", head: true }).eq("household_id", householdId),
    supabase.from("kroger_connections").select("user_id").maybeSingle(),
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

  const start = gettingStarted({
    recipes: recipeCount ?? 0,
    plannedDinners: (weekDinners ?? 0) + (nextDinners ?? 0),
    hasStore: !!hh?.kroger_location_id,
    krogerConnected: !!krogerRow,
    staples: stapleCount ?? 0,
  });
  const thisWeekSummary = summary(weekStart);
  const status = weekStatus({
    dinners: weekDinners ?? 0,
    listBuilt: !!thisWeek?.list_built_at,
    toOrder: thisWeekSummary.toOrder,
    inCart: thisWeekSummary.inCart,
  });

  // Last night's dinner (or the latest unrated one this week), one at a time.
  const rateNext = (toRate ?? [])[0];
  const rateMore = (toRate ?? []).length - (rateNext ? 1 : 0);

  // Tomorrow: a long cook needs a start time, and meat may need to come out of the freezer.
  const tomorrowMeal = h >= 12 ? all.find((m) => m.day === addDays(today, 1) && m.kind === "recipe" && m.recipes) : undefined;
  const reminders = tomorrowMeal?.recipes
    ? headsUp(
        {
          name: tomorrowMeal.recipes.name,
          prepMinutes: tomorrowMeal.recipes.prep_minutes,
          cookMinutes: tomorrowMeal.recipes.cook_minutes,
          tags: tomorrowMeal.recipes.tags ?? [],
          protein: mainProtein(tomorrowMeal.recipes.ingredients ?? []),
        },
        dinnerTime,
        hh?.thaw_reminder ?? false
      )
    : [];

  // With nothing planned tonight: three quick ideas that add in one tap.
  let picks: { id: string; name: string; favorite: boolean; minutes: number }[] = [];
  if (tonight.length === 0) {
    const [{ data: cands }, { data: past }] = await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, diet, favorite, prep_minutes, cook_minutes")
        .eq("archived", false),
      supabase
        .from("planned_meals")
        .select("recipe_id, day")
        .not("recipe_id", "is", null)
        .gte("day", addDays(today, -60))
        .lte("day", today),
    ]);
    const lastDay = new Map<string, string>();
    for (const p of past ?? []) {
      if (p.recipe_id && (!lastDay.has(p.recipe_id) || p.day > lastDay.get(p.recipe_id)!)) lastDay.set(p.recipe_id, p.day);
    }
    picks = quickPicks(
      (cands ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        diet: r.diet === "family" || r.diet === "keto" ? r.diet : "both",
        favorite: r.favorite,
        minutes: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0),
        lastDay: lastDay.get(r.id) ?? null,
      })),
      thisWeek?.mode === "travel" ? "travel" : "home",
      today
    );
  }
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

        {!start.allDone && (
          <Card as="section" tone="accent" aria-labelledby="getting-started">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="getting-started" className="text-lg font-semibold">
                Getting started
              </h2>
              <span className="text-sm text-muted tabular-nums">
                {start.doneCount} of {start.items.length}
              </span>
            </div>
            <ul className="mt-2 divide-y divide-border">
              {start.items.map((it) => (
                <li key={it.key}>
                  <Link
                    href={startLinks[it.key]}
                    className="-mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {it.done ? (
                      <CheckCircle2 aria-hidden className="size-6 shrink-0 text-primary" />
                    ) : (
                      <Circle aria-hidden className="size-6 shrink-0 text-muted" />
                    )}
                    <span className={it.done ? "text-muted line-through" : "font-medium"}>
                      {it.label}
                      <span className="sr-only">{it.done ? ", done" : ", to do"}</span>
                    </span>
                    {!it.done && <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-muted" />}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <nav aria-label="This week" className="-my-2 flex flex-wrap items-center gap-x-1 text-sm">
          {status.map((part, i) => (
            <span key={part.text} className="flex items-center gap-x-1">
              {i > 0 && (
                <span aria-hidden className="text-muted">
                  ·
                </span>
              )}
              <Link
                href={part.to === "plan" ? "/plan" : `/shopping?w=${weekStart}`}
                className="inline-flex min-h-11 items-center rounded-sm px-1 text-primary-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring tabular-nums"
              >
                {part.text}
              </Link>
            </span>
          ))}
        </nav>

        {rateNext && (
          <Card as="section" aria-label="Rate a dinner" className="border-info/40 bg-info-soft p-3">
            <ul>
              <RateRow
                key={rateNext.id}
                id={rateNext.id}
                when={dow(rateNext.day)}
                name={rateNext.recipes?.name ?? "(deleted recipe)"}
                more={rateMore}
              />
            </ul>
          </Card>
        )}

        {/* Tonight: the one thing most visits are about. */}
        <section aria-labelledby="tonight" className="overflow-hidden rounded-lg border-2 border-primary bg-primary-soft">
          <h2 id="tonight" className="px-4 pt-3 text-xs font-semibold tracking-wide text-primary-ink uppercase">
            Tonight
          </h2>
          {tonight.length === 0 && (
            <div className="px-4 pt-2 pb-4">
              <p className="text-lg">Nothing planned for dinner yet.</p>
              <form action={addMeal} className="mt-3">
                <input type="hidden" name="week" value={weekStart} />
                <input type="hidden" name="day" value={today} />
                <input type="hidden" name="slot" value="dinner" />
                <FormBusy label="Adding…">
                  {picks.length > 0 && (
                    <>
                      <p className="mb-2 text-sm text-muted">Quick ideas. Tap one to put it on tonight.</p>
                      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
                        {picks.map((p) => (
                          <li key={p.id}>
                            <RowButton
                              type="submit"
                              name="recipe_id"
                              value={p.id}
                              className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-primary-soft"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  {p.favorite && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
                                  <span className="truncate">{p.name}</span>
                                </span>
                                <span className="text-sm text-muted tabular-nums">{formatMinutes(p.minutes)}</span>
                              </span>
                              <Plus aria-hidden className="size-5 shrink-0 text-primary-ink" />
                            </RowButton>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SubmitButton name="kind" value="leftovers" size="sm">
                      Leftovers
                    </SubmitButton>
                    <SubmitButton name="kind" value="out" size="sm">
                      Eating out
                    </SubmitButton>
                    <ButtonLink href={`/plan?add=${today}`} variant="ghost" size="sm">
                      <CalendarPlus aria-hidden className="size-4" /> Choose something else
                    </ButtonLink>
                  </div>
                </FormBusy>
              </form>
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

        {reminders.length > 0 && (
          <Notice tone="info">
            <ul className="space-y-1">
              {reminders.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Notice>
        )}

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
                      <span className="w-10 shrink-0 text-sm font-medium text-muted">{dow(m.day)}</span>
                      <Thumb image={m.recipes?.image_url ?? null} protein={mainProtein(m.recipes?.ingredients ?? [])} />
                      <span className="min-w-0 flex-1 truncate">{m.recipes?.name ?? "(deleted recipe)"}</span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
                      <span className="w-10 shrink-0 text-sm font-medium text-muted">{dow(m.day)}</span>
                      <Thumb image={null} protein="none" />
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
