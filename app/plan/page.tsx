import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, dayLabel, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { clockBefore, formatMinutes } from "@/lib/format";
import { mainProtein } from "@/lib/protein";
import { proteinLbs } from "@/lib/scale";
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
import { addMeal, copyLastWeek, moveMeal, removeMeal, setMealProtein, setMode } from "./actions";
import { AddMeal, type PickerRecipe } from "./add-meal";
import { DayPills } from "./day-pills";
import { FillWeek } from "./fill-week";
import { RateRow } from "./rate-row";
import { ScrollToToday } from "./scroll-today";

export const metadata: Metadata = { title: "This week" };

const KIND_LABEL: Record<string, string> = {
  leftovers: "Leftovers",
  out: "Eating out",
  quick: "Sports night (quick)",
};

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
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const today = todayET();
  const monday = mondayOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today);
  const { supabase, householdId } = await requireHousehold();

  const [{ data: week }, { data: recipes }, { data: allIngs }, { data: history }, { data: hh }] =
    await Promise.all([
      supabase
        .from("weeks")
        .select("id, mode")
        .eq("household_id", householdId)
        .eq("week_start", monday)
        .maybeSingle(),
      supabase
        .from("recipes")
        .select("id, name, diet, favorite, prep_minutes, cook_minutes, rating")
        .eq("archived", false)
        .order("name"),
      supabase.from("recipe_ingredients").select("recipe_id, name, qty, unit, category"),
      supabase
        .from("planned_meals")
        .select("recipe_id, day")
        .not("recipe_id", "is", null)
        .lt("day", monday)
        .gte("day", addDays(monday, -365)),
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
        .select("id, day, slot, kind, recipe_id, protein_lbs, recipes(name, diet, prep_minutes, cook_minutes, tags)")
        .eq("week_id", week.id)
    : { data: [] };

  const defaultLbs = Number(hh?.default_protein_lbs ?? 2);
  const dinnerTime = String(hh?.dinner_time ?? "18:00:00");
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // ---- what we know about each recipe: main meat, meat weight, last time it was planned
  const ingsBy = new Map<string, { name: string; qty: number | null; unit: string | null; category: string }[]>();
  for (const i of allIngs ?? []) {
    const list = ingsBy.get(i.recipe_id) ?? [];
    list.push({ name: i.name, qty: i.qty == null ? null : Number(i.qty), unit: i.unit, category: i.category });
    ingsBy.set(i.recipe_id, list);
  }
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
    const diff = (Date.parse(monday + "T00:00:00Z") - Date.parse(l + "T00:00:00Z")) / 86_400_000;
    return Math.max(1, Math.ceil(diff / 7));
  };
  const minutesOf = (r: { prep_minutes: number | null; cook_minutes: number | null }) =>
    (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);

  const pickerRecipes: PickerRecipe[] = (recipes ?? []).map((r) => ({
    id: r.id,
    n: r.name,
    d: r.diet,
    f: r.favorite,
    m: minutesOf(r),
    p: proteinOf.get(r.id) ?? "none",
    w: weeksAgo(r.id),
  }));
  const cands: Cand[] = (recipes ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    diet: r.diet,
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
  const fillInput: FillInput = { days, existing, cands, mode, monday };
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

  const weekHasToday = days.includes(today);
  const thisMonday = mondayOf(today);
  const plannedDays = new Set(dinners.map((m) => m.day));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const SLOT_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

  return (
    <>
      <Nav />
      {weekHasToday && !w && <ScrollToToday targetId={`day-${today}`} />}
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <IconLink href={`/plan?w=${addDays(monday, -7)}`} label="Previous week">
            <ChevronLeft aria-hidden className="size-5" />
          </IconLink>
          <h1 className="text-xl font-bold tabular-nums">{weekLabel(monday)}</h1>
          <IconLink href={`/plan?w=${addDays(monday, 7)}`} label="Next week">
            <ChevronRight aria-hidden className="size-5" />
          </IconLink>
          {monday !== thisMonday && (
            <ButtonLink href="/plan" variant="ghost">
              This week
            </ButtonLink>
          )}
          <span className="flex-1" />
          <form action={copyLastWeek}>
            <input type="hidden" name="week" value={monday} />
            <SubmitButton variant="ghost">Copy last week</SubmitButton>
          </form>
        </div>

        <form action={setMode} className="mb-2">
          <input type="hidden" name="week" value={monday} />
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

        {rateQueue.length > 0 && (
          <Card as="section" id="rate-card" className="mb-4 border-info/40 bg-info-soft p-3 not-has-[li]:hidden">
            <ul>
              {rateQueue.map((m) => (
                <RateRow
                  key={m.id}
                  id={m.id}
                  when={shortDay(m.day).split(",")[0]}
                  name={(m.recipes as unknown as { name: string } | null)?.name ?? "(deleted recipe)"}
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
              <form action={copyLastWeek}>
                <input type="hidden" name="week" value={monday} />
                <SubmitButton>Copy last week</SubmitButton>
              </form>
            }
          >
            Nothing is planned yet. Let us suggest dinners with the button below, copy last week, or add meals
            day by day.
          </EmptyState>
        )}

        <FillWeek week={monday} input={fillInput} emptyDays={emptyDays} labels={labels} />

        <DayPills days={days} today={today} planned={plannedDays} />

        <div className="space-y-3">
          {days.map((day) => {
            const dayMeals = (meals ?? []).filter((m) => m.day === day);
            const isToday = day === today;
            // Dinner is the main event; breakfast and lunch sit underneath, smaller.
            const ordered = [
              ...dayMeals.filter((m) => m.slot === "dinner"),
              ...dayMeals.filter((m) => m.slot === "lunch"),
              ...dayMeals.filter((m) => m.slot === "breakfast"),
            ];
            return (
              <Card
                as="section"
                key={day}
                id={`day-${day}`}
                tone={isToday ? "accent" : "default"}
                className="scroll-mt-24"
              >
                <h2 className="flex items-center gap-2 font-semibold">
                  {dayLabel(day)}
                  {isToday && <Badge tone="success">Today</Badge>}
                </h2>
                <ul className="mt-3 space-y-3">
                  {ordered.map((m) => {
                    const big = m.slot === "dinner";
                    const off = m.kind !== "recipe";
                    const r = m.recipes as unknown as {
                      name: string;
                      diet: string;
                      prep_minutes: number | null;
                      cook_minutes: number | null;
                      tags: string[];
                    } | null;
                    const total = (r?.prep_minutes ?? 0) + (r?.cook_minutes ?? 0);
                    const longCook =
                      big && !!r && ((r.cook_minutes ?? 0) >= 120 || r.tags?.includes("slow-cooker"));
                    const hasKetoPlate = dayMeals.some(
                      (o) =>
                        o.id !== m.id &&
                        o.slot === m.slot &&
                        o.kind === "recipe" &&
                        (o.recipes as unknown as { diet: string } | null)?.diet === "both"
                    );
                    const needsKeto = mode === "home" && r?.diet === "family" && !hasKetoPlate;
                    const ideas = needsKeto ? ketoIdeas(m.recipe_id) : [];
                    const mealName = r?.name ?? KIND_LABEL[m.kind] ?? "meal";
                    const prot = m.recipe_id ? (proteinOf.get(m.recipe_id) ?? "none") : "none";
                    return (
                      <Removable key={m.id} id={m.id} label={mealName} action={removeMeal}>
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            {!big && <p className="text-xs font-medium text-muted uppercase">{SLOT_LABEL[m.slot]}</p>}
                            {off ? (
                              <p className={big ? "text-lg text-muted italic" : "text-muted italic"}>
                                {KIND_LABEL[m.kind]}
                              </p>
                            ) : (
                              <Link
                                href={`/recipes/${m.recipe_id}`}
                                className={
                                  big
                                    ? "text-lg leading-snug font-semibold hover:underline"
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
                          <Menu label={`Options for ${mealName}`} title={mealName}>
                            <div className="space-y-5">
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
                                <Field label="Move to">
                                  <Select name="day" defaultValue={m.day}>
                                    {days.map((d) => (
                                      <option key={d} value={d}>
                                        {shortDay(d)}
                                      </option>
                                    ))}
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
                                <input type="hidden" name="week" value={monday} />
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
                <AddMeal week={monday} day={day} dayName={dayLabel(day)} mode={mode} recipes={pickerRecipes} />
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
