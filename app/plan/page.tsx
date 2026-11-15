import { expandIngredients } from "@/lib/components";
import { loadComponentMap } from "@/lib/load-components";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ShoppingCart } from "lucide-react";
import { RecipeThumb } from "@/app/recipes/recipe-thumb";
import { costKey, estimateCost } from "@/lib/recipe-cost";
import { weekSummary, type WeekCost } from "@/lib/week-summary";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { asDiet } from "@/lib/diet";
import { KIND_LABEL } from "@/lib/meal-kinds";
import { addDays, dayLabel, weekStartOf, todayET, weekLabel, weekRelation } from "@/lib/dates";
import { clockBefore, formatMinutes } from "@/lib/format";
import { mainProtein } from "@/lib/protein";
import { proteinLbs, scaleFactor } from "@/lib/scale";
import type { Cand, FillInput } from "@/lib/autofill";
import { Removable, RemoveMenuItem } from "@/components/removable";
import { Badge, DietBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { IconLink } from "@/components/ui/icon-link";
import { Menu } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { SubmitButton } from "@/components/ui/submit-button";
import { addMeal, moveMeal, removeMeal, setMealProtein, setMode } from "./actions";
import { AddMeal, type PickerRecipe } from "./add-meal";
import { CopyLastWeek } from "./copy-last-week";
import { DayPills } from "./day-pills";
import { DragHandle } from "./drag-handle";
import { PlanProvider } from "./plan-context";
import { LiveRefresh } from "@/components/live-refresh";
import { SwapMeal } from "./swap-meal";
import { FillWeek } from "./fill-week";
import { RateRow } from "./rate-row";
import { ScrollToToday } from "./scroll-today";

export const metadata: Metadata = { title: "This week" };


const shortDay = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; add?: string }>;
}) {
  const { w, add } = await searchParams;
  const today = todayET();
  const weekStart = weekStartOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today);
  const { supabase, householdId } = await requireHousehold();

  const [{ data: week }, { data: recipes }, { data: allIngs }, { data: history }, { data: hh }] =
    await Promise.all([
      supabase
        .from("weeks")
        .select("id, mode")
        .eq("household_id", householdId)
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("recipes")
        .select("id, name, diet, favorite, prep_minutes, cook_minutes, rating, image_url")
        .eq("archived", false)
        .order("name"),
      supabase.from("recipe_ingredients").select("recipe_id, name, qty, unit, category, component_id, from_scratch"),
      supabase
        .from("planned_meals")
        .select("recipe_id, day")
        .not("recipe_id", "is", null)
        .lt("day", weekStart)
        .gte("day", addDays(weekStart, -365)),
      supabase
        .from("households")
        .select("default_protein_lbs, dinner_time")
        .eq("id", householdId)
        .single(),
    ]);

  const mode = (week?.mode ?? "home") as "home" | "travel";
  const { data: meals } = week
    ? await supabase
        .from("planned_meals")
        .select("id, day, slot, kind, recipe_id, protein_lbs, recipes(name, diet, prep_minutes, cook_minutes, tags, image_url)")
        .eq("week_id", week.id)
    : { data: [] };

  const defaultLbs = Number(hh?.default_protein_lbs ?? 2);
  const dinnerTime = String(hh?.dinner_time ?? "18:00:00");
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ---- what we know about each recipe: main meat, meat weight, last time it was planned
  const comps = await loadComponentMap(supabase);
  const rawBy = new Map<string, NonNullable<typeof allIngs>>();
  for (const i of allIngs ?? []) rawBy.set(i.recipe_id, [...(rawBy.get(i.recipe_id) ?? []), i]);
  const ingsBy = new Map(
    [...rawBy].map(([id, rows]) => [
      id,
      expandIngredients(rows.map((r) => ({ ...r, qty: r.qty == null ? null : Number(r.qty) })), comps),
    ])
  );
  const proteinOf = new Map<string, string>();
  const baseLbs = new Map<string, number>();
  for (const r of recipes ?? []) {
    const ings = ingsBy.get(r.id) ?? [];
    proteinOf.set(r.id, mainProtein(ings));
    const b = proteinLbs(ings);
    if (b) baseLbs.set(r.id, b);
  }
  const lastDay = new Map<string, string>();
  for (const h of history ?? []) {
    if (h.recipe_id && (!lastDay.has(h.recipe_id) || h.day > lastDay.get(h.recipe_id)!)) {
      lastDay.set(h.recipe_id, h.day);
    }
  }
  const weeksAgo = (id: string) => {
    const l = lastDay.get(id);
    if (!l) return null;
    const diff = (Date.parse(weekStart + "T00:00:00Z") - Date.parse(l + "T00:00:00Z")) / 86_400_000;
    return Math.max(1, Math.ceil(diff / 7));
  };
  const minutesOf = (r: { prep_minutes: number | null; cook_minutes: number | null }) =>
    (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);

  const pickerRecipes: PickerRecipe[] = (recipes ?? []).map((r) => ({
    id: r.id,
    n: r.name,
    d: asDiet(r.diet),
    f: r.favorite,
    m: minutesOf(r),
    p: proteinOf.get(r.id) ?? "none",
    w: weeksAgo(r.id),
    img: r.image_url,
  }));
  const cands: Cand[] = (recipes ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    diet: asDiet(r.diet),
    favorite: r.favorite,
    minutes: minutesOf(r),
    protein: proteinOf.get(r.id) ?? "none",
    lastDay: lastDay.get(r.id) ?? null,
    rating: r.rating ?? 0,
  }));

  // Dinners from the past week that nobody has rated yet.
  const { data: toRate } = await supabase
    .from("planned_meals")
    .select("id, day, recipes(name)")
    .eq("kind", "recipe")
    .eq("slot", "dinner")
    .is("rating", null)
    .not("recipe_id", "is", null)
    .gte("day", addDays(today, -7))
    .lt("day", today)
    .order("day", { ascending: false });
  // One compact card, one dinner at a time.
  const rateQueue = (toRate ?? []).slice(0, 1);
  const rateMore = (toRate ?? []).length - rateQueue.length;

  const dinners = (meals ?? []).filter((m) => m.slot === "dinner");
  const existing: FillInput["existing"] = {};
  for (const m of dinners) {
    existing[m.day] = {
      id: m.recipe_id,
      protein: m.recipe_id ? (proteinOf.get(m.recipe_id) ?? null) : null,
    };
  }
  const emptyDays = days.filter((d) => !dinners.some((m) => m.day === d));
  const fillInput: FillInput = { days, existing, cands, mode, weekStart };
  const labels = Object.fromEntries(days.map((d) => [d, shortDay(d)]));

  const plannedIds = new Set((meals ?? []).map((m) => m.recipe_id).filter(Boolean));
  // Keto-friendly recipes with the same main meat as a family-only dinner.
  const ketoIdeas = (recipeId: string | null) => {
    const prot = recipeId ? proteinOf.get(recipeId) : null;
    if (!prot || prot === "none") return [];
    return (recipes ?? [])
      .filter((r) => r.diet === "both" && proteinOf.get(r.id) === prot && !plannedIds.has(r.id))
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          minutesOf(a) - minutesOf(b) ||
          (lastDay.get(a.id) ?? "").localeCompare(lastDay.get(b.id) ?? "")
      )
      .slice(0, 2);
  };

  // ---- one line about the week: dinners, meats, and about what it costs
  const plannedMeals = dinners.filter((m) => m.recipe_id);
  const priceNames = [...new Set(plannedMeals.flatMap((m) => (ingsBy.get(m.recipe_id!) ?? []).map((i) => costKey(i.name))))];
  const [{ data: priceRows }, { data: stapleRows }, { data: listRows }] = await Promise.all([
    priceNames.length
      ? supabase
          .from("kroger_matches")
          .select("name_key, price, size, description")
          .eq("household_id", householdId)
          .in("name_key", priceNames)
      : Promise.resolve({ data: [] }),
    supabase.from("pantry_staples").select("name_key").eq("household_id", householdId),
    week
      ? supabase.from("shopping_items").select("to_order, kroger_upc, kroger_price, order_qty").eq("week_id", week.id)
      : Promise.resolve({ data: [] }),
  ]);
  let weekCost: WeekCost | null = null;
  const pricedList = (listRows ?? []).filter((i) => i.to_order && i.kroger_upc && i.kroger_price != null);
  if (pricedList.length > 0) {
    // The built list counts a package shared by two recipes once, so it is the closest number.
    weekCost = { amount: pricedList.reduce((sum, i) => sum + Number(i.kroger_price) * i.order_qty, 0), exact: true };
  } else if (plannedMeals.length > 0) {
    const matches = new Map(
      (priceRows ?? []).map((m) => [m.name_key, { price: m.price == null ? null : Number(m.price), size: m.size, description: m.description }])
    );
    const staples = new Set((stapleRows ?? []).map((s) => s.name_key));
    const amount = plannedMeals.reduce((sum, m) => {
      const ings = (ingsBy.get(m.recipe_id!) ?? []).map((i) => ({ ...i, family_only: false }));
      const factor = scaleFactor(ings, Number(m.protein_lbs ?? defaultLbs));
      return sum + estimateCost(ings, factor, 1, matches, staples).total;
    }, 0);
    if (amount > 0) weekCost = { amount, exact: false };
  }
  const summaryLine = weekSummary({
    dinners: dinners.length,
    proteins: dinners.map((m) => (m.recipe_id ? (proteinOf.get(m.recipe_id) ?? "none") : "none")),
    cost: weekCost,
  });

  const weekHasToday = days.includes(today);
  const thisWeekStart = weekStartOf(today);
  const relation = weekRelation(weekStart, thisWeekStart);
  const plannedDays = new Set(dinners.map((m) => m.day));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const SLOT_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

  // One day: its meals (dinner first), and the Add meal button. Used in the week grid and inside a folded past day.
  const dayCard = (day: string, idx: number, withId: boolean) => {
    const dayMeals = (meals ?? []).filter((m) => m.day === day);
    const isToday = day === today;
    const ordered = [
      ...dayMeals.filter((m) => m.slot === "dinner"),
      ...dayMeals.filter((m) => m.slot === "lunch"),
      ...dayMeals.filter((m) => m.slot === "breakfast"),
    ];
    return (
      <Card
        as="section"
        key={day}
        id={withId ? `day-${day}` : undefined}
        data-day-drop={day}
        data-day-label={shortDay(day)}
        tone={isToday ? "accent" : "default"}
        className="scroll-mt-24 transition-shadow lg:p-2 xl:p-3"
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="lg:hidden">{dayLabel(day)}</span>
          <span className="hidden lg:inline">{shortDay(day)}</span>
          {isToday && <Badge tone="success">Today</Badge>}
        </h2>
        <ul className="mt-3 space-y-3">
          {ordered.map((m) => {
            const big = m.slot === "dinner";
            const off = m.kind !== "recipe";
            const r = m.recipes;
            const total = (r?.prep_minutes ?? 0) + (r?.cook_minutes ?? 0);
            const longCook = big && !!r && ((r.cook_minutes ?? 0) >= 120 || r.tags?.includes("slow-cooker"));
            const hasKetoPlate = dayMeals.some(
              (o) => o.id !== m.id && o.slot === m.slot && o.kind === "recipe" && o.recipes?.diet === "both"
            );
            const needsKeto = mode === "home" && r?.diet === "family" && !hasKetoPlate;
            const ideas = needsKeto ? ketoIdeas(m.recipe_id) : [];
            const mealName = r?.name ?? KIND_LABEL[m.kind] ?? "meal";
            const prot = m.recipe_id ? (proteinOf.get(m.recipe_id) ?? "none") : "none";
            return (
              <Removable key={m.id} id={m.id} label={mealName} action={removeMeal}>
                {/* In the narrow week columns the picture and the buttons share a line, and the name goes under them. */}
                <div className={`flex items-start gap-2 lg:gap-1 ${big && !off ? "lg:flex-wrap" : ""}`}>
                  {big && !off && <RecipeThumb image={r?.image_url ?? null} protein={prot} />}
                  <div className={`min-w-0 flex-1 ${big && !off ? "lg:order-last lg:basis-full" : ""}`}>
                    {!big && <p className="text-xs font-medium text-muted uppercase">{SLOT_LABEL[m.slot]}</p>}
                    {off ? (
                      <p className={big ? "text-lg text-muted italic" : "text-muted italic"}>{KIND_LABEL[m.kind]}</p>
                    ) : (
                      <Link
                        href={`/recipes/${m.recipe_id}`}
                        className={
                          big
                            ? "text-lg leading-snug font-semibold hover:underline lg:text-base"
                            : "leading-snug hover:underline"
                        }
                      >
                        {r?.name ?? "(deleted recipe)"}
                      </Link>
                    )}
                    {!off && r && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm text-muted tabular-nums">{formatMinutes(total)}</span>
                        {big && prot !== "none" && <Badge>{cap(prot)}</Badge>}
                        {big && <DietBadge diet={r.diet} />}
                        {longCook && (
                          <Badge tone="info" className="tabular-nums">
                            start by {clockBefore(dinnerTime, total)}
                          </Badge>
                        )}
                        {m.protein_lbs != null && <Badge className="tabular-nums">{Number(m.protein_lbs)} lb</Badge>}
                        {needsKeto && <Badge tone="warning">needs a keto option</Badge>}
                      </div>
                    )}
                  </div>
                  <DragHandle id={m.id} day={day} name={mealName} />
                  <Menu label={`Options for ${mealName}`} title={mealName} align={idx < 4 ? "left" : "right"}>
                    <div className="space-y-5">
                      {big && !off && m.recipe_id && (
                        <SwapMeal id={m.id} day={day} recipeId={m.recipe_id} name={mealName} lbs={m.protein_lbs} />
                      )}
                      {!off && m.recipe_id && baseLbs.has(m.recipe_id) && (
                        <form action={setMealProtein} className="space-y-2">
                          <input type="hidden" name="id" value={m.id} />
                          <Field label="Pounds of meat" hint={`Leave blank for your usual ${defaultLbs} lb.`}>
                            <Input
                              name="lbs"
                              type="number"
                              step="0.25"
                              min="0.5"
                              max="10"
                              defaultValue={m.protein_lbs ?? ""}
                              placeholder={String(defaultLbs)}
                            />
                          </Field>
                          <SubmitButton className="w-full" data-menu-close>
                            Save pounds
                          </SubmitButton>
                        </form>
                      )}
                      <form action={moveMeal} className="space-y-2">
                        <input type="hidden" name="id" value={m.id} />
                        <Field label="Move to" hint="If that day already has one, the two swap.">
                          <Select name="day" defaultValue={m.day}>
                            <optgroup label="This week">
                              {days.map((d) => (
                                <option key={d} value={d}>
                                  {shortDay(d)}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Next week">
                              {days.map((d) => (
                                <option key={addDays(d, 7)} value={addDays(d, 7)}>
                                  {shortDay(addDays(d, 7))}
                                </option>
                              ))}
                            </optgroup>
                          </Select>
                        </Field>
                        <SubmitButton className="w-full" data-menu-close>
                          Move
                        </SubmitButton>
                      </form>
                      <RemoveMenuItem label={`Remove ${mealName}`} />
                    </div>
                  </Menu>
                </div>
                {ideas.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted">Keto plate with the same meat:</span>
                    {ideas.map((k) => (
                      <form action={addMeal} key={k.id}>
                        <input type="hidden" name="week" value={weekStart} />
                        <input type="hidden" name="day" value={day} />
                        <input type="hidden" name="slot" value={m.slot} />
                        <input type="hidden" name="recipe_id" value={k.id} />
                        <SubmitButton size="sm">
                          <Plus aria-hidden className="size-4" /> {k.name}
                        </SubmitButton>
                      </form>
                    ))}
                  </div>
                )}
              </Removable>
            );
          })}
          {dayMeals.length === 0 && <li className="text-muted">Nothing planned</li>}
        </ul>
        <AddMeal
          week={weekStart}
          day={day}
          dayName={dayLabel(day)}
          mode={mode}
          recipes={pickerRecipes}
          defaultOpen={add === day}
        />
      </Card>
    );
  };

  return (
    <>
      <Nav />
      {weekHasToday && !w && <ScrollToToday targetId={`day-${today}`} />}
      {week && (
        <LiveRefresh
          sources={[
            { table: "planned_meals", filter: `week_id=eq.${week.id}`, deletes: true },
            { table: "weeks", filter: `id=eq.${week.id}` },
          ]}
          knownIds={(meals ?? []).map((m) => m.id)}
        />
      )}
      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6 lg:max-w-7xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <IconLink href={`/plan?w=${addDays(weekStart, -7)}`} label="Previous week">
            <ChevronLeft aria-hidden className="size-5" />
          </IconLink>
          <h1 className="text-xl font-bold tabular-nums">{weekLabel(weekStart)}</h1>
          {relation && <Badge tone="info">{relation}</Badge>}
          <IconLink href={`/plan?w=${addDays(weekStart, 7)}`} label="Next week">
            <ChevronRight aria-hidden className="size-5" />
          </IconLink>
          {weekStart !== thisWeekStart && (
            <ButtonLink href="/plan" variant="ghost">
              This week
            </ButtonLink>
          )}
          <span className="flex-1" />
          <CopyLastWeek week={weekStart} />
        </div>

        <form action={setMode} className="mb-2">
          <input type="hidden" name="week" value={weekStart} />
          <Segmented
            label="Kind of week"
            name="mode"
            value={mode}
            options={[
              { value: "home", label: "Home week" },
              { value: "travel", label: "Travel week" },
            ]}
          />
        </form>
        <p className="mb-4 text-sm text-muted tabular-nums">
          {mode === "home" ? "Keto and family dinners." : "Family-only dinners."} Dinner at{" "}
          {clockBefore(dinnerTime, 0)} · {defaultLbs} lb meat per meal ·{" "}
          <Link href="/settings#household" className="text-primary-ink underline">
            change
          </Link>
        </p>
        <p className="mb-4 text-sm font-medium tabular-nums" aria-label="Week summary">
          {summaryLine}
        </p>

        {rateQueue.length > 0 && (
          <Card as="section" id="rate-card" className="mb-4 border-info/40 bg-info-soft p-3 not-has-[li]:hidden">
            <ul>
              {rateQueue.map((m) => (
                <RateRow
                  key={m.id}
                  id={m.id}
                  when={shortDay(m.day).split(",")[0]}
                  name={m.recipes?.name ?? "(deleted recipe)"}
                  more={rateMore}
                />
              ))}
            </ul>
          </Card>
        )}

        {(meals ?? []).length === 0 && (
          <EmptyState
            icon={<CalendarDays aria-hidden className="size-8" />}
            title="A fresh week"
            className="mb-4"
            action={
              <CopyLastWeek week={weekStart} variant="secondary" />
            }
          >
            Nothing is planned yet. Let us suggest dinners with the button below, copy last week, or add meals
            day by day.
          </EmptyState>
        )}

        <PlanProvider input={fillInput}>
          <FillWeek week={weekStart} input={fillInput} emptyDays={emptyDays} labels={labels} />

          <DayPills days={days} today={today} planned={plannedDays} />

          <div className="space-y-3 lg:grid lg:grid-cols-7 lg:items-start lg:gap-3 lg:space-y-0">
            {days.map((day, idx) => {
              const card = dayCard(day, idx, true);
              if (!(weekStart === thisWeekStart && day < today)) return card;
              // A day that is over folds down to one line, so today is near the top.
              const names = (meals ?? [])
                .filter((m) => m.day === day && m.slot === "dinner")
                .map((m) => m.recipes?.name ?? KIND_LABEL[m.kind] ?? "meal")
                .join(", ");
              return (
                <details key={day} id={`day-${day}`} className="group scroll-mt-24 rounded-lg border border-border bg-surface">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
                    <span className="shrink-0 font-medium">{shortDay(day)}</span>
                    <span className="min-w-0 truncate text-muted">{names || "Nothing planned"}</span>
                  </summary>
                  <div className="p-1">{dayCard(day, idx, false)}</div>
                </details>
              );
            })}
          </div>
        </PlanProvider>

        <div className="mt-6">
          <ButtonLink href={`/shopping?w=${weekStart}`} size="lg" className="w-full sm:w-auto">
            <ShoppingCart aria-hidden className="size-5" /> Shopping list for {relation?.toLowerCase() ?? "this week"}
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
