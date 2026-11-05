import Link from "next/link";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, dayLabel, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { clockBefore } from "@/lib/format";
import { mainProtein } from "@/lib/protein";
import { proteinLbs } from "@/lib/scale";
import type { Cand, FillInput } from "@/lib/autofill";
import { addMeal, copyLastWeek, moveMeal, removeMeal, savePlanSettings, setMealProtein, setMode } from "./actions";
import { AddMeal, type PickerRecipe } from "./add-meal";
import { FillWeek } from "./fill-week";
import { ScrollToToday } from "./scroll-today";

export const metadata: Metadata = { title: "This week" };

const SLOTS = ["breakfast", "lunch", "dinner"] as const;
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
  const { supabase, householdId, inviteCode } = await requireHousehold();

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
        .select("id, name, diet, favorite, prep_minutes, cook_minutes")
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
  }));

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

  return (
    <>
      <Nav inviteCode={inviteCode} />
      {weekHasToday && !w && <ScrollToToday />}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href={`/plan?w=${addDays(monday, -7)}`} className="rounded border px-2 py-1">
            ←
          </Link>
          <h1 className="text-xl font-bold">{weekLabel(monday)}</h1>
          <Link href={`/plan?w=${addDays(monday, 7)}`} className="rounded border px-2 py-1">
            →
          </Link>
          <span className="flex-1" />
          <form action={copyLastWeek}>
            <input type="hidden" name="week" value={monday} />
            <button className="text-sm underline">Copy last week</button>
          </form>
        </div>

        <form action={setMode} className="mb-3 flex flex-wrap gap-2 text-sm">
          <input type="hidden" name="week" value={monday} />
          <button
            name="mode"
            value="home"
            className={`rounded-full border px-3 py-1 ${mode === "home" ? "bg-green-700 text-white" : "bg-white"}`}
          >
            Home week (keto + family)
          </button>
          <button
            name="mode"
            value="travel"
            className={`rounded-full border px-3 py-1 ${mode === "travel" ? "bg-green-700 text-white" : "bg-white"}`}
          >
            Travel week (family only)
          </button>
        </form>

        <form
          action={savePlanSettings}
          className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm"
        >
          <label className="flex items-center gap-1.5">
            Usual meat per meal
            <input
              name="lbs"
              type="number"
              step="0.25"
              min="0.5"
              max="10"
              defaultValue={defaultLbs}
              className="w-16 rounded border bg-white px-2 py-1"
            />
            lb
          </label>
          <label className="flex items-center gap-1.5">
            Dinner at
            <input
              name="time"
              type="time"
              defaultValue={dinnerTime.slice(0, 5)}
              className="rounded border bg-white px-2 py-1"
            />
          </label>
          <button className="rounded border bg-white px-2 py-1">Save</button>
        </form>

        <FillWeek week={monday} input={fillInput} emptyDays={emptyDays} labels={labels} />

        <div className="space-y-3">
          {days.map((day) => {
            const dayMeals = (meals ?? []).filter((m) => m.day === day);
            const isToday = day === today;
            return (
              <section
                key={day}
                id={isToday ? "today" : undefined}
                className={`scroll-mt-24 rounded-xl border bg-white p-4 ${
                  isToday ? "border-2 border-green-600 bg-green-50/40" : ""
                }`}
              >
                <h2 className="flex items-center gap-2 font-semibold">
                  {dayLabel(day)}
                  {isToday && (
                    <span className="rounded-full bg-green-700 px-2 py-0.5 text-xs font-medium text-white">
                      Today
                    </span>
                  )}
                </h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {SLOTS.flatMap((slot) =>
                    dayMeals
                      .filter((m) => m.slot === slot)
                      .map((m) => {
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
                          slot === "dinner" &&
                          !!r &&
                          ((r.cook_minutes ?? 0) >= 120 || r.tags?.includes("slow-cooker"));
                        const hasKetoPlate = dayMeals.some(
                          (o) =>
                            o.id !== m.id &&
                            o.slot === m.slot &&
                            o.kind === "recipe" &&
                            (o.recipes as unknown as { diet: string } | null)?.diet === "both"
                        );
                        const needsKeto = mode === "home" && r?.diet === "family" && !hasKetoPlate;
                        const ideas = needsKeto ? ketoIdeas(m.recipe_id) : [];
                        return (
                          <li key={m.id}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="w-20 text-xs uppercase text-neutral-500">{slot}</span>
                              {off ? (
                                <span className="italic text-neutral-600">{KIND_LABEL[m.kind]}</span>
                              ) : (
                                <Link href={`/recipes/${m.recipe_id}`} className="hover:underline">
                                  {r?.name ?? "(deleted recipe)"}
                                </Link>
                              )}
                              {longCook && (
                                <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-800">
                                  start by {clockBefore(dinnerTime, total)}
                                </span>
                              )}
                              {!off && m.recipe_id && baseLbs.has(m.recipe_id) && (
                                <form action={setMealProtein} className="flex items-center gap-1 text-xs">
                                  <input type="hidden" name="id" value={m.id} />
                                  <input
                                    name="lbs"
                                    type="number"
                                    step="0.25"
                                    min="0.5"
                                    max="10"
                                    defaultValue={m.protein_lbs ?? ""}
                                    placeholder={String(defaultLbs)}
                                    aria-label="Pounds of meat"
                                    className="w-14 rounded border px-1 py-0.5"
                                  />
                                  <span>lb</span>
                                  <button className="underline">set</button>
                                </form>
                              )}
                              {needsKeto && (
                                <span className="rounded bg-amber-100 px-1.5 text-xs">needs a keto option</span>
                              )}
                              <span className="ml-auto flex items-center gap-3">
                                <details className="relative text-xs">
                                  <summary className="cursor-pointer text-neutral-500 hover:text-neutral-800">
                                    move
                                  </summary>
                                  <form
                                    action={moveMeal}
                                    className="absolute right-0 z-10 mt-1 flex items-center gap-1 rounded border bg-white p-2 shadow"
                                  >
                                    <input type="hidden" name="id" value={m.id} />
                                    <select name="day" defaultValue={m.day} className="rounded border px-1 py-0.5">
                                      {days.map((d) => (
                                        <option key={d} value={d}>
                                          {shortDay(d)}
                                        </option>
                                      ))}
                                    </select>
                                    <button className="rounded bg-green-700 px-2 py-0.5 text-white">Go</button>
                                  </form>
                                </details>
                                <form action={removeMeal}>
                                  <input type="hidden" name="id" value={m.id} />
                                  <button aria-label="Remove" className="text-neutral-400 hover:text-red-700">
                                    ✕
                                  </button>
                                </form>
                              </span>
                            </div>
                            {ideas.length > 0 && (
                              <div className="ml-20 mt-1 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-neutral-500">Keto plate with the same meat:</span>
                                {ideas.map((k) => (
                                  <form action={addMeal} key={k.id}>
                                    <input type="hidden" name="week" value={monday} />
                                    <input type="hidden" name="day" value={day} />
                                    <input type="hidden" name="slot" value={m.slot} />
                                    <input type="hidden" name="recipe_id" value={k.id} />
                                    <button className="rounded-full border border-green-700 px-2 py-0.5 text-green-800 hover:bg-green-50">
                                      + {k.name}
                                    </button>
                                  </form>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })
                  )}
                  {dayMeals.length === 0 && <li className="text-neutral-400">Nothing planned</li>}
                </ul>
                <AddMeal week={monday} day={day} mode={mode} recipes={pickerRecipes} />
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
