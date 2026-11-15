import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireHousehold } from "@/lib/household";
import { loadComponents } from "@/lib/load-components";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Components" };

export default async function ComponentsPage({ searchParams }: { searchParams: Promise<{ saved?: string; removed?: string }> }) {
  const { saved, removed } = await searchParams;
  const { supabase } = await requireHousehold();
  const [all, { data: used }] = await Promise.all([
    loadComponents(supabase),
    supabase.from("recipe_ingredients").select("component_id, recipe_id").not("component_id", "is", null),
  ]);
  const uses = new Map<string, Set<string>>();
  for (const u of used ?? []) {
    if (!u.component_id) continue;
    uses.set(u.component_id, (uses.get(u.component_id) ?? new Set()).add(u.recipe_id));
  }

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/recipes">All recipes</BackLink>
        <div className="mb-2 mt-2 flex items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold">Components</h1>
          <ButtonLink href="/recipes/components/new" variant="primary">
            <Plus aria-hidden className="size-4" /> Add
          </ButtonLink>
        </div>
        <p className="mb-4 text-muted">
          Things you make from several ingredients, like pico de gallo. Save one here, drop it into any recipe with @, and
          pick per recipe whether to make it or buy it.
        </p>
        {saved && <Notice tone="success" className="mb-3">Saved.</Notice>}
        {removed && <Notice tone="success" className="mb-3">Deleted.</Notice>}
        {all.length === 0 ? (
          <Card>
            <p>No components yet. Try adding one, like Pico de gallo with tomatoes, onion, cilantro and lime juice.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {all.map((c) => {
              const n = uses.get(c.id)?.size ?? 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/recipes/components/${c.id}`}
                    className="block min-h-11 rounded-lg border border-border bg-surface p-3 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-sm text-muted">
                      {c.ingredients.map((i) => i.name).join(", ")}
                    </span>
                    <span className="block text-xs text-muted">
                      {n === 0 ? "Not used yet" : `In ${n} recipe${n === 1 ? "" : "s"}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
