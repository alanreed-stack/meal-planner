import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, hourET, mondayOf, todayET } from "@/lib/dates";
import { clockBefore, formatMinutes } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { CalendarPlus, ChefHat, ChevronRight, Clock, ShoppingCart } from "lucide-react";
import { RecipeTile } from "@/app/recipes/recipe-tile";
import { mainProtein } from "@/lib/protein";

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
    ingredients: { name: string; qty: number | null; unit: string | null; category: string }[] | null;
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
      .select("id, day, kind, recipe_id, protein_lbs, recipes(name, prep_minutes, cook_minutes, image_url, ingredients:recipe_ingredients(name, qty, unit, category))")
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
              <ButtonLink href="/plan" variant="primary" className="mt-3">
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

        <Card as="section" aria-labelledby="groceries">
          <SectionHeader>
            <span id="groceries">Groceries</span>
          </SectionHeader>
          {toOrder.length === 0 ? (
            <p className="mt-2 text-muted">No shopping list for this week yet.</p>
          ) : (
            <div className="mt-2">
              <p className="tabular-nums">
                <b>{inCart}</b> of {toOrder.length} in your Kroger cart
              </p>
              <div
                role="progressbar"
                aria-label="Items in Kroger cart"
                aria-valuemin={0}
                aria-valuemax={toOrder.length}
                aria-valuenow={inCart}
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((inCart / toOrder.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <ButtonLink href="/shopping" className="mt-3">
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
