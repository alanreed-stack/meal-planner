import { notFound } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { searchProducts, type Product } from "@/lib/kroger";
import { chooseProduct } from "../../kroger-actions";
import { splitOptions } from "@/lib/match";

export const metadata = { title: "Pick a Kroger product" };

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const { supabase, householdId } = await requireHousehold();

  const { data: item } = await supabase
    .from("shopping_items")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();
  const { data: h } = await supabase
    .from("households")
    .select("kroger_location_id")
    .eq("id", householdId)
    .single();

  const term = q?.trim() || splitOptions(item.name)[0] || item.name;
  let results: Product[] = [];
  let failed = false;
  if (h?.kroger_location_id) {
    try {
      results = await searchProducts(term, h.kroger_location_id, 10);
    } catch {
      failed = true;
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/shopping">Back to list</BackLink>
        <h1 className="mt-2 text-xl font-bold">Pick a Kroger product for: {item.name}</h1>
        <form className="my-4 flex gap-2">
          <Input name="q" defaultValue={term} aria-label="Search Kroger products" className="min-w-0 flex-1" />
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
        {failed && (
          <Notice tone="error" className="mb-3">
            Kroger search failed. Try again.
          </Notice>
        )}
        <Card as="ul" padded={false} className="divide-y divide-border">
          {results.map((p) => (
            <li key={p.upc} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate">{p.description}</div>
                <div className="text-xs text-muted tabular-nums">
                  {[p.brand, p.size].filter(Boolean).join(" · ")}
                  {p.price ? ` · $${p.price.toFixed(2)}` : ""}
                </div>
              </div>
              <form action={chooseProduct}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="upc" value={p.upc} />
                <input type="hidden" name="product_id" value={p.productId} />
                <input
                  type="hidden"
                  name="description"
                  value={[p.brand, p.description, p.size].filter(Boolean).join(" · ")}
                />
                <input type="hidden" name="price" value={p.price ?? ""} />
                <input type="hidden" name="size" value={p.size} />
                <SubmitButton>Use this</SubmitButton>
              </form>
            </li>
          ))}
          {results.length === 0 && !failed && (
            <li className="px-3 py-3 text-muted">No results. Try different words.</li>
          )}
        </Card>
      </main>
    </>
  );
}
