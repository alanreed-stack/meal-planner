import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { loadComponents } from "@/lib/load-components";
import { componentToLine } from "@/lib/components";
import { ingredientToLine } from "@/lib/ingredients";
import { NewRecipeForm } from "../../new/form";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, householdId } = await requireHousehold();

  const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("name, qty, unit, family_only, component_id, from_scratch")
    .eq("recipe_id", id)
    .order("sort");

  const compList = await loadComponents(supabase);
  const comps = new Map(compList.map((c) => [c.id, c]));

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href={`/recipes/${id}`}>Back to recipe</BackLink>
        <h1 className="mb-4 mt-2 text-2xl font-bold">Edit: {r.name}</h1>
        <NewRecipeForm
          householdId={householdId}
          components={compList}
          edit={{
            id: r.id,
            name: r.name,
            description: r.description ?? "",
            diet: r.diet,
            keto_swap: r.keto_swap ?? "",
            notes: r.notes ?? "",
            prep_minutes: r.prep_minutes,
            cook_minutes: r.cook_minutes,
            servings: r.servings,
            difficulty: r.difficulty,
            ingredients: (ings ?? [])
              .map((i) =>
                i.component_id
                  ? componentToLine({
                      name: comps.get(i.component_id)?.name ?? i.name,
                      batches: i.qty == null ? null : Number(i.qty),
                      from_scratch: i.from_scratch,
                      family_only: i.family_only,
                    })
                  : ingredientToLine({
                  name: i.name,
                  qty: i.qty == null ? null : Number(i.qty),
                  unit: i.unit,
                  family_only: i.family_only,
                })
              )
              .join("\n"),
            steps: (r.steps ?? []).join("\n"),
            tags: (r.tags ?? []).join(", "),
            image_url: r.image_url ?? "",
          }}
        />
      </main>
    </>
  );
}
