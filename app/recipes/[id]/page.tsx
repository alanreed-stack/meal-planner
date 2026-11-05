import { notFound, redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { niceQty, proteinLbs, scaleFactor } from "@/lib/scale";
import { formatIngredient, formatMinutes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { addDays, dayLabel, mondayOf, todayET } from "@/lib/dates";
import { ChefHat, Pencil, Trash2 } from "lucide-react";
import { Badge, DietBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { mainProtein } from "@/lib/protein";
import { FavoriteButton, RatingButtons } from "../controls";
import { RecipeTile } from "../recipe-tile";
import { AddToWeek } from "./add-to-week";
import { LbsControl } from "./lbs-control";

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

  const protein = mainProtein(list);
  const totalMin = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  const serves = Math.round(r.servings * factor);
  const weekDays = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(monday, i);
    return { value: d, label: `${dayLabel(d)}${d === today ? " (today)" : ""}` };
  });

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/recipes">All recipes</BackLink>

        <div className="mt-1 overflow-hidden rounded-lg">
          {r.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt="" referrerPolicy="no-referrer" className="h-52 w-full object-cover" />
          ) : (
            <RecipeTile protein={protein} className="h-40" />
          )}
        </div>

        <h1 className="mt-4 text-2xl leading-tight font-bold">{r.name}</h1>
        {r.description && <p className="mt-1 text-muted">{r.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <DietBadge diet={r.diet} />
          <Badge>{r.difficulty}</Badge>
        </div>

        <Card as="dl" className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["Prep", formatMinutes(r.prep_minutes)],
            ["Cook", formatMinutes(r.cook_minutes)],
            ["Total", formatMinutes(totalMin)],
            ["Serves", base !== null ? `${serves} · ${Math.round(target * 100) / 100} lb` : String(serves)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dd className="text-sm leading-tight font-semibold tabular-nums">{value}</dd>
              <dt className="mt-0.5 text-xs text-muted">{label}</dt>
            </div>
          ))}
        </Card>

        <div className="mt-4 flex gap-2">
          <ButtonLink href={`/recipes/${r.id}/cook?lbs=${target}`} variant="primary" className="flex-1">
            <ChefHat aria-hidden className="size-4" /> Start cooking
          </ButtonLink>
          {!r.archived && (
            <AddToWeek recipeId={r.id} recipeName={r.name} days={weekDays} today={today} />
          )}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <ButtonLink href={`/recipes/${r.id}/edit`} variant="ghost">
            <Pencil aria-hidden className="size-4" /> Edit
          </ButtonLink>
          <span className="flex-1" />
          <FavoriteButton id={r.id} favorite={r.favorite} />
          <RatingButtons id={r.id} rating={r.rating} />
        </div>

        {r.keto_swap && (
          <Notice tone="success" className="mt-4">
            <b>Keto vs. family:</b> {r.keto_swap}
          </Notice>
        )}

        <h2 className="mt-8 text-lg font-semibold">Ingredients</h2>
        {base !== null ? (
          <div className="mt-2">
            <LbsControl value={target} base={base} factor={factor} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">This recipe has no weighed meat, so the amounts are as written.</p>
        )}
        <ul className="mt-3 space-y-2 tabular-nums">
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

        <h2 className="mt-8 text-lg font-semibold">Steps</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-6 leading-relaxed marker:font-semibold marker:text-muted">
          {r.steps.map((s: string, i: number) => (
            <li key={i} className="pl-1">
              {s}
            </li>
          ))}
        </ol>

        {!r.archived && (
          <form action={archiveRecipe} className="mt-10 border-t border-border pt-4">
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" className="text-danger-ink hover:bg-danger-soft">
              <Trash2 aria-hidden className="size-4" /> Remove this recipe (you can restore it later)
            </SubmitButton>
          </form>
        )}
      </main>
    </>
  );
}
