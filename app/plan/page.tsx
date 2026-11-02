import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, dayLabel, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { addMeal, copyLastWeek, removeMeal, setMode } from "./actions";

const SLOTS = ["breakfast", "lunch", "dinner"] as const;

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const monday = mondayOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayET());
  const { supabase, householdId, inviteCode } = await requireHousehold();

  const [{ data: week }, { data: recipes }] = await Promise.all([
    supabase
      .from("weeks")
      .select("id, mode")
      .eq("household_id", householdId)
      .eq("week_start", monday)
      .maybeSingle(),
    supabase
      .from("recipes")
      .select("id, name, diet, favorite")
      .eq("archived", false)
      .order("name"),
  ]);

  const mode = (week?.mode ?? "home") as "home" | "travel";
  const { data: meals } = week
    ? await supabase
        .from("planned_meals")
        .select("id, day, slot, recipe_id, recipes(name, diet)")
        .eq("week_id", week.id)
    : { data: [] };

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sortedRecipes = [...(recipes ?? [])].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)
  );

  return (
    <>
      <Nav inviteCode={inviteCode} />
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

        <form action={setMode} className="mb-5 flex gap-2 text-sm">
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

        <div className="space-y-3">
          {days.map((day) => {
            const dayMeals = (meals ?? []).filter((m) => m.day === day);
            return (
              <section key={day} className="rounded-xl border bg-white p-4">
                <h2 className="font-semibold">{dayLabel(day)}</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {SLOTS.flatMap((slot) =>
                    dayMeals
                      .filter((m) => m.slot === slot)
                      .map((m) => {
                        const r = m.recipes as unknown as { name: string; diet: string } | null;
                        const needsKeto = mode === "home" && r?.diet === "family";
                        return (
                          <li key={m.id} className="flex items-center gap-2">
                            <span className="w-20 text-xs uppercase text-neutral-500">{slot}</span>
                            <Link href={`/recipes/${m.recipe_id}`} className="hover:underline">
                              {r?.name ?? "(deleted recipe)"}
                            </Link>
                            {needsKeto && (
                              <span className="rounded bg-amber-100 px-1.5 text-xs">
                                needs a keto option
                              </span>
                            )}
                            <form action={removeMeal} className="ml-auto">
                              <input type="hidden" name="id" value={m.id} />
                              <button aria-label="Remove" className="text-neutral-400 hover:text-red-700">
                                ✕
                              </button>
                            </form>
                          </li>
                        );
                      })
                  )}
                  {dayMeals.length === 0 && <li className="text-neutral-400">Nothing planned</li>}
                </ul>
                <form action={addMeal} className="mt-3 flex flex-wrap gap-2 text-sm">
                  <input type="hidden" name="week" value={monday} />
                  <input type="hidden" name="day" value={day} />
                  <select name="slot" defaultValue="dinner" className="rounded border px-2 py-1">
                    {SLOTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    name="recipe_id"
                    defaultValue=""
                    className="min-w-0 flex-1 rounded border px-2 py-1"
                  >
                    <option value="" disabled>
                      Choose a recipe…
                    </option>
                    {sortedRecipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.favorite ? "★ " : ""}
                        {r.name}
                        {mode === "home" && r.diet === "family" ? " (family only)" : ""}
                      </option>
                    ))}
                  </select>
                  <button className="rounded bg-green-700 px-3 py-1 text-white">Add</button>
                </form>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
