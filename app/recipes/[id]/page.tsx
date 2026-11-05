import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { niceQty, proteinLbs, scaleFactor } from "@/lib/scale";
import { formatIngredient, formatMinutes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { addDays, dayLabel, mondayOf, todayET } from "@/lib/dates";
import { addMeal } from "@/app/plan/actions";
import { Pencil, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { SubmitIconButton } from "@/components/ui/icon-button";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";

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
  const { supabase, householdId } = await requireHousehold();
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
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/recipes">All recipes</BackLink>
        {r.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="mt-1 h-52 w-full rounded-lg object-cover"
          />
        )}
        <h1 className="mt-2 text-2xl font-bold">{r.name}</h1>
        <p className="text-muted">{r.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ButtonLink href={`/recipes/${r.id}/cook?lbs=${target}`} variant="primary">
            Start cooking
          </ButtonLink>
          <ButtonLink href={`/recipes/${r.id}/edit`}>
            <Pencil aria-hidden className="size-4" /> Edit
          </ButtonLink>
          <form action={rateRecipe} className="ml-auto flex items-center gap-1">
            <input type="hidden" name="id" value={r.id} />
            <SubmitIconButton
              label="Liked it"
              variant="secondary"
              name="rating"
              value={r.rating === 1 ? "0" : "1"}
              pressed={r.rating === 1}
            >
              <ThumbsUp aria-hidden className="size-5" />
            </SubmitIconButton>
            <SubmitIconButton
              label="Not a fan"
              variant="secondary"
              name="rating"
              value={r.rating === -1 ? "0" : "-1"}
              pressed={r.rating === -1}
              pressedTone="danger"
            >
              <ThumbsDown aria-hidden className="size-5" />
            </SubmitIconButton>
          </form>
        </div>

        {!r.archived && (
          <Card as="details" className="mt-3 p-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-primary-ink">
              <Plus aria-hidden className="size-4" /> Add to this week
            </summary>
            <form action={addMeal} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="go" value="1" />
              <input type="hidden" name="recipe_id" value={r.id} />
              <Select name="day" defaultValue={today} aria-label="Day" className="w-auto">
                {Array.from({ length: 14 }, (_, i) => addDays(monday, i)).map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)}
                    {d === today ? " (today)" : ""}
                  </option>
                ))}
              </Select>
              <Select name="slot" defaultValue="dinner" aria-label="Meal" className="w-auto">
                <option>dinner</option>
                <option>lunch</option>
                <option>breakfast</option>
              </Select>
              <SubmitButton variant="primary">Add to plan</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-muted">This week and next week are listed.</p>
          </Card>
        )}
        <p className="mt-2 text-sm text-muted tabular-nums">
          Prep {formatMinutes(r.prep_minutes)} · Cook {formatMinutes(r.cook_minutes)} · Serves about{" "}
          {Math.round(r.servings * factor)} · {r.difficulty}
        </p>

        {r.keto_swap && (
          <Notice tone="success" className="mt-4">
            <b>Keto vs. family:</b> {r.keto_swap}
          </Notice>
        )}

        <h2 className="mt-6 text-lg font-semibold">Ingredients</h2>
        {base !== null ? (
          <form className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="lbs">Make it with</label>
            <Input
              id="lbs"
              name="lbs"
              type="number"
              step="0.25"
              min="0.5"
              max="10"
              defaultValue={target}
              className="w-24"
            />
            <span>lb of meat</span>
            <Button type="submit">Update</Button>
            <span className="text-xs text-muted tabular-nums">
              {scaled
                ? `Scaled from ${Math.round(base * 100) / 100} lb as written (×${Math.round(factor * 100) / 100}).`
                : "Matches the recipe as written."}
            </span>
          </form>
        ) : (
          <p className="mt-1 text-xs text-muted">
            This recipe has no weighed meat, so the amounts are as written.
          </p>
        )}
        <ul className="mt-2 space-y-1 text-sm tabular-nums">
          {list.map((i) => (
            <li key={i.id}>
              {formatIngredient(i.qty != null ? niceQty(i.qty * factor, i.unit) : null, i.unit, i.name)}
              {i.family_only && (
                <Badge tone="diet-family" className="ml-2">
                  family only
                </Badge>
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
          <form action={archiveRecipe} className="mt-8 border-t border-border pt-4">
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" className="text-danger-ink hover:bg-danger-soft">
              Remove this recipe (you can restore it later)
            </SubmitButton>
          </form>
        )}
      </main>
    </>
  );
}
