import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { ingredientToLine } from "@/lib/ingredients";
import { ComponentForm } from "../component-form";
import { deleteComponent } from "../actions";

export const metadata: Metadata = { title: "Edit component" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditComponentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireHousehold();
  const { data: c } = await supabase.from("components").select("id, name, buy_as, buy_unit").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: ings }, { data: used }] = await Promise.all([
    supabase.from("component_ingredients").select("name, qty, unit").eq("component_id", id).order("sort"),
    supabase.from("recipe_ingredients").select("recipes(name)").eq("component_id", id),
  ]);
  const names = [...new Set((used ?? []).map((u) => u.recipes?.name).filter(Boolean) as string[])];

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/recipes/components">Components</BackLink>
        <h1 className="mb-1 mt-2 text-2xl font-bold">{c.name}</h1>
        <p className="mb-4 text-sm text-muted">
          {names.length ? `Used in ${names.join(", ")}. Changes here show up in all of them.` : "Not used in any recipe yet."}
        </p>
        <ComponentForm
          error={error}
          values={{
            id: c.id,
            name: c.name,
            buy_as: c.buy_as ?? "",
            buy_unit: c.buy_unit,
            ingredients: (ings ?? [])
              .map((i) => ingredientToLine({ name: i.name, qty: i.qty == null ? null : Number(i.qty), unit: i.unit, family_only: false }))
              .join("\n"),
          }}
        />
        <form action={deleteComponent} className="mt-10 border-t border-border pt-4">
          <input type="hidden" name="id" value={c.id} />
          <SubmitButton variant="ghost" className="text-danger-ink hover:bg-danger-soft">
            <Trash2 aria-hidden className="size-4" /> Delete this component
          </SubmitButton>
        </form>
      </main>
    </>
  );
}
