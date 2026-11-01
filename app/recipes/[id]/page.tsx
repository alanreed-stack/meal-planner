import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, inviteCode } = await requireHousehold();

  const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", id)
    .order("sort");

  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/recipes" className="text-sm text-green-800 underline">
          ← All recipes
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{r.name}</h1>
        <p className="text-neutral-600">{r.description}</p>
        <p className="mt-2 text-sm text-neutral-500">
          Prep {r.prep_minutes} min · Cook {r.cook_minutes} min · Serves {r.servings} · {r.difficulty}
        </p>

        {r.keto_swap && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm">
            <b>Keto vs. family:</b> {r.keto_swap}
          </div>
        )}

        <h2 className="mt-6 text-lg font-semibold">Ingredients</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(ings ?? []).map((i) => (
            <li key={i.id}>
              {i.qty ?? ""} {i.unit ?? ""} {i.name}
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
      </main>
    </>
  );
}
