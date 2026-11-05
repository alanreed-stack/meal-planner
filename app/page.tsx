import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, hourET, mondayOf, todayET } from "@/lib/dates";
import { clockBefore, formatMinutes } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  leftovers: "Leftovers",
  out: "Eating out",
  quick: "Sports night (quick)",
};

type Meal = {
  id: string;
  day: string;
  kind: string;
  recipe_id: string | null;
  protein_lbs: number | null;
  recipes: {
    name: string;
    prep_minutes: number | null;
    cook_minutes: number | null;
    image_url: string | null;
  } | null;
};

export default async function Home() {
  const { supabase, householdId, displayName } = await requireHousehold();
  const today = todayET();
  const monday = mondayOf(today);
  const h = hourET();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const [{ data: hh }, { data: meals }, { data: week }] = await Promise.all([
    supabase.from("households").select("default_protein_lbs, dinner_time").eq("id", householdId).single(),
    supabase
      .from("planned_meals")
      .select("id, day, kind, recipe_id, protein_lbs, recipes(name, prep_minutes, cook_minutes, image_url)")
      .eq("slot", "dinner")
      .gte("day", today)
      .lte("day", addDays(today, 4))
      .order("day"),
    supabase
      .from("weeks")
      .select("id")
      .eq("household_id", householdId)
      .eq("week_start", monday)
      .maybeSingle(),
  ]);
  const { data: items } = week
    ? await supabase.from("shopping_items").select("to_order, sent_at").eq("week_id", week.id)
    : { data: [] };

  const dinnerTime = String(hh?.dinner_time ?? "18:00:00");
  const defaultLbs = Number(hh?.default_protein_lbs ?? 2);
  const all = (meals ?? []) as unknown as Meal[];
  const tonight = all.filter((m) => m.day === today);
  const later = all.filter((m) => m.day !== today);

  const toOrder = (items ?? []).filter((i) => i.to_order);
  const inCart = toOrder.filter((i) => i.sent_at).length;
  const dow = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold">
          {greeting}
          {displayName ? `, ${displayName}` : ""}
        </h1>

        <section className="rounded-2xl border-2 border-green-600 bg-green-50/50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-green-800">Tonight</h2>
          {tonight.length === 0 && (
            <div className="mt-2">
              <p className="text-lg">Nothing planned for dinner yet.</p>
              <Link href="/plan" className="mt-3 inline-block rounded-lg bg-green-700 px-4 py-2 font-medium text-white">
                Plan tonight
              </Link>
            </div>
          )}
          <ul className="mt-2 space-y-4">
            {tonight.map((m) => {
              if (m.kind !== "recipe" || !m.recipes) {
                return (
                  <li key={m.id} className="text-lg italic text-neutral-700">
                    {KIND_LABEL[m.kind] ?? "Dinner"}
                  </li>
                );
              }
              const total = (m.recipes.prep_minutes ?? 0) + (m.recipes.cook_minutes ?? 0);
              const lbs = m.protein_lbs ?? defaultLbs;
              return (
                <li key={m.id}>
                  {m.recipes.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.recipes.image_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="mb-2 h-36 w-full rounded-xl object-cover"
                    />
                  )}
                  <p className="text-xl font-semibold">{m.recipes.name}</p>
                  <p className="mt-1 text-sm text-neutral-700">
                    {formatMinutes(total)} total · start by{" "}
                    <b className="text-green-800">{clockBefore(dinnerTime, total)}</b> for dinner at{" "}
                    {clockBefore(dinnerTime, 0)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/recipes/${m.recipe_id}/cook?lbs=${lbs}`}
                      className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white"
                    >
                      Start cooking
                    </Link>
                    <Link href={`/recipes/${m.recipe_id}?lbs=${lbs}`} className="rounded-lg border bg-white px-4 py-2">
                      View recipe
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {later.length > 0 && (
          <section className="rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Coming up</h2>
            <ul className="mt-2 divide-y">
              {later.map((m) => (
                <li key={m.id} className="flex items-baseline gap-3 py-2">
                  <span className="w-24 shrink-0 text-sm text-neutral-500">{dow(m.day)}</span>
                  {m.kind === "recipe" && m.recipe_id ? (
                    <Link href={`/recipes/${m.recipe_id}`} className="hover:underline">
                      {m.recipes?.name ?? "(deleted recipe)"}
                    </Link>
                  ) : (
                    <span className="italic text-neutral-600">{KIND_LABEL[m.kind] ?? "Dinner"}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Groceries</h2>
          {toOrder.length === 0 ? (
            <p className="mt-2 text-neutral-700">No shopping list for this week yet.</p>
          ) : (
            <p className="mt-2 text-neutral-700">
              {toOrder.length} item{toOrder.length === 1 ? "" : "s"} to order
              {inCart > 0 ? `, ${inCart} already in your Kroger cart` : ""}.
            </p>
          )}
          <Link href="/shopping" className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm">
            Open shopping list
          </Link>
        </section>

        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/plan" className="rounded-lg border bg-white px-4 py-2">
            Plan the week
          </Link>
          <Link href="/recipes/new" className="rounded-lg border bg-white px-4 py-2">
            Add a recipe
          </Link>
        </div>
      </main>
    </>
  );
}
