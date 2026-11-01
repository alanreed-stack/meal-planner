import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { searchProducts, type Product } from "@/lib/kroger";
import { chooseProduct } from "../../kroger-actions";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const { supabase, householdId, inviteCode } = await requireHousehold();

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

  const term = q?.trim() || item.name;
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
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/shopping" className="text-sm text-green-800 underline">
          ← Back to list
        </Link>
        <h1 className="mt-2 text-xl font-bold">Pick a Kroger product for: {item.name}</h1>
        <form className="my-4 flex gap-2 text-sm">
          <input name="q" defaultValue={term} className="min-w-0 flex-1 rounded border px-2 py-1" />
          <button className="rounded bg-green-700 px-3 py-1 text-white">Search</button>
        </form>
        {failed && <p className="text-sm text-red-700">Kroger search failed. Try again.</p>}
        <ul className="divide-y rounded-xl border bg-white">
          {results.map((p) => (
            <li key={p.upc} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate">{p.description}</div>
                <div className="text-xs text-neutral-500">
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
                <button className="rounded border px-2 py-1">Use this</button>
              </form>
            </li>
          ))}
          {results.length === 0 && !failed && (
            <li className="px-3 py-3 text-neutral-500">No results. Try different words.</li>
          )}
        </ul>
      </main>
    </>
  );
}
