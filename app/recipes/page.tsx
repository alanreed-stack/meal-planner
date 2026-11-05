import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { missingStarterCount, seedStarterRecipes } from "@/lib/seed-recipes";
import { formatMinutes } from "@/lib/format";
import { mainProtein } from "@/lib/protein";
import { todayET } from "@/lib/dates";

export const metadata: Metadata = { title: "Recipes" };

async function toggleFavorite(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  const id = String(formData.get("id"));
  const next = formData.get("favorite") !== "true";
  await supabase.from("recipes").update({ favorite: next }).eq("id", id);
  revalidatePath("/recipes");
}

async function addStarterRecipes() {
  "use server";
  const { supabase, householdId, user } = await requireHousehold();
  await seedStarterRecipes(supabase, householdId, user.id);
  revalidatePath("/recipes");
}

async function setArchived(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  await supabase
    .from("recipes")
    .update({ archived: formData.get("archive") === "true", favorite: false })
    .eq("id", String(formData.get("id")));
  revalidatePath("/recipes");
}

async function deleteForever(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  await supabase.from("recipes").delete().eq("id", String(formData.get("id")));
  revalidatePath("/recipes");
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "both", label: "Keto + family" },
  { key: "keto", label: "Keto only" },
  { key: "family", label: "Family-only" },
  { key: "quick", label: "Quick" },
  { key: "archived", label: "Removed" },
];
const PROTEINS = ["chicken", "beef", "pork", "turkey", "shrimp", "fish"];
const SORTS = [
  { key: "name", label: "Name" },
  { key: "time", label: "Cook time" },
  { key: "recent", label: "Least recently made" },
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string; p?: string; s?: string }>;
}) {
  const { f = "all", q = "", p = "", s = "name" } = await searchParams;
  const { supabase, householdId } = await requireHousehold();
  const today = todayET();

  const [missing, { data: all }, { data: ings }, { data: made }] = await Promise.all([
    missingStarterCount(supabase, householdId),
    supabase
      .from("recipes")
      .select(
        "id, name, description, diet, prep_minutes, cook_minutes, difficulty, tags, favorite, archived, rating, image_url"
      ),
    supabase.from("recipe_ingredients").select("recipe_id, name, qty, unit, category"),
    supabase.from("planned_meals").select("recipe_id, day").not("recipe_id", "is", null).lte("day", today),
  ]);

  const ingsBy = new Map<string, { name: string; qty: number | null; unit: string | null; category: string }[]>();
  for (const i of ings ?? []) {
    const list = ingsBy.get(i.recipe_id) ?? [];
    list.push({ name: i.name, qty: i.qty == null ? null : Number(i.qty), unit: i.unit, category: i.category });
    ingsBy.set(i.recipe_id, list);
  }
  const lastMade = new Map<string, string>();
  for (const m of made ?? []) {
    if (m.recipe_id && (!lastMade.has(m.recipe_id) || m.day > lastMade.get(m.recipe_id)!)) {
      lastMade.set(m.recipe_id, m.day);
    }
  }

  const total = (r: { prep_minutes: number | null; cook_minutes: number | null }) =>
    (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  const protein = (id: string) => mainProtein(ingsBy.get(id) ?? []);
  const term = q.trim().toLowerCase();

  const recipes = (all ?? [])
    .filter((r) => r.archived === (f === "archived"))
    .filter((r) => {
      if (f === "favorites") return r.favorite;
      if (f === "both") return r.diet === "both";
      if (f === "keto") return r.diet === "keto";
      if (f === "family") return r.diet === "family";
      if (f === "quick") return r.tags?.includes("quick") || total(r) <= 30;
      return true;
    })
    .filter((r) => !p || protein(r.id) === p)
    .filter((r) => !term || r.name.toLowerCase().includes(term))
    .sort((a, b) => {
      if (s === "time") return total(a) - total(b) || a.name.localeCompare(b.name);
      if (s === "recent") {
        // Never made first, then the longest ago.
        const la = lastMade.get(a.id) ?? "";
        const lb = lastMade.get(b.id) ?? "";
        return la.localeCompare(lb) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

  const href = (over: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { f, p, s, q, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "f" && v === "all") && !(k === "s" && v === "name")) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/recipes?${qs}` : "/recipes";
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "bg-green-700 text-white" : "bg-white"}`;

  const madeLabel = (id: string) => {
    const l = lastMade.get(id);
    if (!l) return "Never made";
    const days = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(l + "T00:00:00Z")) / 86_400_000);
    if (days <= 0) return "Made today";
    if (days < 7) return `Made ${days} day${days === 1 ? "" : "s"} ago`;
    const wk = Math.round(days / 7);
    return `Made ${wk} week${wk === 1 ? "" : "s"} ago`;
  };

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-bold">Recipes</h1>
          <Link href="/recipes/new" className="rounded-lg bg-green-700 px-3 py-1.5 text-sm text-white">
            + Add recipe
          </Link>
          <form className="flex gap-2">
            <input type="hidden" name="f" value={f} />
            <input type="hidden" name="p" value={p} />
            <input type="hidden" name="s" value={s} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search"
              className="rounded-lg border px-3 py-1.5 text-sm"
            />
          </form>
        </div>
        {/* threshold keeps the banner away if you delete a couple of starters for good */}
        {missing >= 10 && f === "all" && (
          <form
            action={addStarterRecipes}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm"
          >
            <span className="flex-1">
              {missing} more starter recipes are available: Peruvian, Asian, Indian, Greek, Italian
              and more, all with keto and family versions.
            </span>
            <button className="rounded-lg bg-green-700 px-3 py-1.5 text-white">Add them</button>
          </form>
        )}

        <div className="mb-2 flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <Link key={x.key} href={href({ f: x.key })} className={chip(f === x.key)}>
              {x.label}
            </Link>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Meat:</span>
          {PROTEINS.map((x) => (
            <Link key={x} href={href({ p: p === x ? "" : x })} className={chip(p === x)}>
              {x}
            </Link>
          ))}
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Sort by:</span>
          {SORTS.map((x) => (
            <Link key={x.key} href={href({ s: x.key })} className={chip(s === x.key)}>
              {x.label}
            </Link>
          ))}
          <span className="ml-auto text-xs text-neutral-500">
            {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
          </span>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-xl border bg-white">
              {r.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-36 w-full object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/recipes/${r.id}`} className="font-semibold hover:underline">
                    {r.rating === 1 && <span title="Liked">👍 </span>}
                    {r.rating === -1 && <span title="Not a fan">👎 </span>}
                    {r.name}
                  </Link>
                  <form action={toggleFavorite}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="favorite" value={String(r.favorite)} />
                    <button aria-label="Toggle favorite" className="text-xl leading-none">
                      {r.favorite ? "★" : "☆"}
                    </button>
                  </form>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{r.description}</p>
                {f === "archived" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <form action={setArchived}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="archive" value="false" />
                      <button className="rounded border px-2 py-1">Restore</button>
                    </form>
                    <details>
                      <summary className="cursor-pointer text-red-700">Delete forever</summary>
                      <form action={deleteForever} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <span className="text-xs">This can&apos;t be undone.</span>
                        <button className="rounded bg-red-700 px-2 py-1 text-white">Yes, delete</button>
                      </form>
                    </details>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded bg-green-100 px-2 py-0.5">
                    {r.diet === "both" ? "Keto + family" : r.diet === "keto" ? "Keto only" : "Family only"}
                  </span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5">{formatMinutes(total(r))}</span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5">{r.difficulty}</span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5">{madeLabel(r.id)}</span>
                </div>
              </div>
            </li>
          ))}
          {recipes.length === 0 && (
            <li className="text-neutral-500">
              {f === "archived" ? (
                "Nothing has been removed."
              ) : (
                <>
                  No recipes match.{" "}
                  <Link href="/recipes" className="text-green-800 underline">
                    Clear filters
                  </Link>
                </>
              )}
            </li>
          )}
        </ul>
      </main>
    </>
  );
}
