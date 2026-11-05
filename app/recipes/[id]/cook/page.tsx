import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { formatIngredient } from "@/lib/format";
import { niceQty, scaleFactor } from "@/lib/scale";
import { CookMode } from "./cook-mode";

export const metadata: Metadata = { title: "Cooking" };

export default async function CookPage({
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
    .select("name, qty, unit, category, family_only")
    .eq("recipe_id", id)
    .order("sort");

  const list = (ings ?? []).map((i) => ({ ...i, qty: i.qty == null ? null : Number(i.qty) }));
  const factor = scaleFactor(list, target);

  return (
    <CookMode
      name={r.name}
      backHref={`/recipes/${id}`}
      ketoNote={r.keto_swap ?? ""}
      ingredients={list.map((i) => ({
        text: formatIngredient(i.qty != null ? niceQty(i.qty * factor, i.unit) : null, i.unit, i.name),
        familyOnly: i.family_only,
      }))}
      steps={r.steps ?? []}
    />
  );
}
