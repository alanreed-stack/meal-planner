import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { missingStarterCount, seedStarterRecipes } from "@/lib/seed-recipes";
import { formatMinutes } from "@/lib/format";
import type { Metadata } from "next";

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
  { key: "keto", label: "Keto-friendly" },
  { key: "family", label: "Family-only" },
  { key: "quick", label: "Quick" },
  { key: "archived", label: "Removed" },
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const { f = "all", q = "" } = await searchParams;
  const { supabase, householdId, inviteCode } = await requireHousehold();
  const missing = await missingStarterCount(supabase, householdId);

  let query = supabase
    .from("recipes")
    .select("id, name, description, diet, prep_minutes, cook_minutes, difficulty, tags, favorite")
    .eq("archived", f === "archived")
    .order("name");
  if (f === "favorites") query = query.eq("favorite", true);
  if (f === "keto") query = query.eq("diet", "both");
  if (f === "family") query = query.eq("diet", "family");
  if (f === "quick") query = query.contains("tags", ["quick"]);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: recipes } = await query;

  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-bold">Recipes</h1>
          <Link href="/recipes/new" className="rounded-lg bg-green-700 px-3 py-1.5 text-sm text-white">
            + Add recipe
          </Link>
          <form className="flex gap-2">
            <input type="hidden" name="f" value={f} />
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
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={`/recipes?f=${x.key}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                f === x.key ? "bg-green-700 text-white" : "bg-white"
              }`}
            >
              {x.label}
            </Link>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(recipes ?? []).map((r) => (
            <li key={r.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/recipes/${r.id}`} className="font-semibold hover:underline">
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
                  {r.diet === "both" ? "Keto + family" : r.diet === "keto" ? "Keto" : "Family only"}
                </span>
                <span className="rounded bg-neutral-100 px-2 py-0.5">
                  {formatMinutes((r.prep_minutes ?? 0) + (r.cook_minutes ?? 0))}
                </span>
                <span className="rounded bg-neutral-100 px-2 py-0.5">{r.difficulty}</span>
              </div>
            </li>
          ))}
          {recipes?.length === 0 && (
            <li className="text-neutral-500">
              {f === "archived" ? "Nothing has been removed." : "No recipes match."}
            </li>
          )}
        </ul>
      </main>
    </>
  );
}
