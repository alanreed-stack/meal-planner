import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { ingredientToLine } from "@/lib/ingredients";
import { NewRecipeForm } from "../../new/form";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireHousehold();

  const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("name, qty, unit, family_only")
    .eq("recipe_id", id)
    .order("sort");

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link href={`/recipes/${id}`} className="text-sm text-green-800 underline">
          ← Back to recipe
        </Link>
        <h1 className="mb-4 mt-2 text-2xl font-bold">Edit: {r.name}</h1>
        <NewRecipeForm
          edit={{
            id: r.id,
            name: r.name,
            description: r.description ?? "",
            diet: r.diet,
            keto_swap: r.keto_swap ?? "",
            prep_minutes: r.prep_minutes,
            cook_minutes: r.cook_minutes,
            servings: r.servings,
            difficulty: r.difficulty,
            ingredients: (ings ?? [])
              .map((i) =>
                ingredientToLine({
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
