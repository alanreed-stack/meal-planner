import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { niceQty, proteinLbs, scaleFactor } from "@/lib/scale";
import { formatIngredient, formatMinutes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { addDays, dayLabel, mondayOf, todayET } from "@/lib/dates";
import { addMeal } from "@/app/plan/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Recipe" };
}

/** 1 = liked, -1 = not a fan, 0 = clear. Thumbs-down recipes are suggested less. */
async function rateRecipe(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  const n = Number(formData.get("rating"));
  const rating = n === 1 || n === -1 ? n : null;
  const id = String(formData.get("id"));
  await supabase.from("recipes").update({ rating }).eq("id", id);
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
}

async function archiveRecipe(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  await supabase
    .from("recipes")
    .update({ archived: true, favorite: false })
    .eq("id", String(formData.get("id")));
  redirect("/recipes");
}

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lbs?: string }>;
}) {
  const { id } = await params;
  const { lbs } = await searchParams;
  const { supabase, householdId, inviteCode } = await requireHousehold();
  const { data: hh } = await supabase
    .from("households")
    .select("default_protein_lbs")
    .eq("id", householdId)
    .single();
  const asked = Number(lbs);
  const target =
    lbs && Number.isFinite(asked) && asked > 0
      ? Math.min(10, Math.max(0.5, asked))
      : Number(hh?.default_protein_lbs ?? 2);

  const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", id)
    .order("sort");

  const today = todayET();
  const monday = mondayOf(today);
  const list = (ings ?? []).map((i) => ({ ...i, qty: i.qty == null ? null : Number(i.qty) }));
  const base = proteinLbs(list);
  const factor = scaleFactor(list, target);
  const scaled = base !== null && Math.abs(factor - 1) > 0.01;

  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/recipes" className="text-sm text-green-800 underline">
          ← All recipes
        </Link>
        {r.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="mt-3 h-52 w-full rounded-xl object-cover"
          />
        )}
        <h1 className="mt-2 text-2xl font-bold">{r.name}</h1>
        <p className="text-neutral-600">{r.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/recipes/${r.id}/cook?lbs=${target}`}
            className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white"
          >
            Start cooking
          </Link>
          <Link href={`/recipes/${r.id}/edit`} className="rounded-lg border px-3 py-2">
            Edit
          </Link>
          <form action={rateRecipe} className="ml-auto flex items-center gap-1">
            <input type="hidden" name="id" value={r.id} />
            <button
              name="rating"
              value={r.rating === 1 ? "0" : "1"}
              aria-label="Liked it"
              className={`rounded-lg border px-2.5 py-1.5 ${r.rating === 1 ? "bg-green-100" : "bg-white"}`}
            >
              👍
            </button>
            <button
              name="rating"
              value={r.rating === -1 ? "0" : "-1"}
              aria-label="Not a fan"
              className={`rounded-lg border px-2.5 py-1.5 ${r.rating === -1 ? "bg-red-100" : "bg-white"}`}
            >
              👎
            </button>
          </form>
        </div>

        {!r.archived && (
          <details className="mt-3 rounded-lg border bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium text-green-800">+ Add to this week</summary>
            <form action={addMeal} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="go" value="1" />
              <input type="hidden" name="recipe_id" value={r.id} />
              <select name="day" defaultValue={today} className="rounded border px-2 py-1" aria-label="Day">
                {Array.from({ length: 14 }, (_, i) => addDays(monday, i)).map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)}
                    {d === today ? " (today)" : ""}
                  </option>
                ))}
              </select>
              <select name="slot" defaultValue="dinner" className="rounded border px-2 py-1" aria-label="Meal">
                <option>dinner</option>
                <option>lunch</option>
                <option>breakfast</option>
              </select>
              <button className="rounded bg-green-700 px-3 py-1 text-white">Add to plan</button>
            </form>
            <p className="mt-2 text-xs text-neutral-500">This week and next week are listed.</p>
          </details>
        )}
        <p className="mt-2 text-sm text-neutral-500">
          Prep {formatMinutes(r.prep_minutes)} · Cook {formatMinutes(r.cook_minutes)} · Serves about{" "}
          {Math.round(r.servings * factor)} · {r.difficulty}
        </p>

        {r.keto_swap && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm">
            <b>Keto vs. family:</b> {r.keto_swap}
          </div>
        )}

        <h2 className="mt-6 text-lg font-semibold">Ingredients</h2>
        {base !== null ? (
          <form className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="lbs">Make it with</label>
            <input
              id="lbs"
              name="lbs"
              type="number"
              step="0.25"
              min="0.5"
              max="10"
              defaultValue={target}
              className="w-20 rounded border px-2 py-1"
            />
            <span>lb of meat</span>
            <button className="rounded border px-2 py-1">Update</button>
            <span className="text-xs text-neutral-500">
              {scaled
                ? `Scaled from ${Math.round(base * 100) / 100} lb as written (×${Math.round(factor * 100) / 100}).`
                : "Matches the recipe as written."}
            </span>
          </form>
        ) : (
          <p className="mt-1 text-xs text-neutral-500">
            This recipe has no weighed meat, so the amounts are as written.
          </p>
        )}
        <ul className="mt-2 space-y-1 text-sm">
          {list.map((i) => (
            <li key={i.id}>
              {formatIngredient(i.qty != null ? niceQty(i.qty * factor, i.unit) : null, i.unit, i.name)}
              {i.family_only && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs">family only</span>
              )}
            </li>
          ))}
        </ul>

        <h2 className="mt-6 text-lg font-semibold">Steps</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {r.steps.map((s: string, i: number) => (
            <li key={i}>{s}</li>
          ))}
        </ol>

        {!r.archived && (
          <form action={archiveRecipe} className="mt-8 border-t pt-4">
            <input type="hidden" name="id" value={r.id} />
            <button className="text-sm text-red-700 underline">
              Remove this recipe (you can restore it later)
            </button>
          </form>
        )}
      </main>
    </>
  );
}
