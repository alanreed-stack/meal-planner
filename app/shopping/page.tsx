import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addDays, mondayOf, todayET, weekLabel } from "@/lib/dates";
import { addItem, deleteItem, generateList, toggleItem } from "./actions";

const CATEGORIES = ["produce", "meat", "dairy", "bakery", "frozen", "pantry", "other"];

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const monday = mondayOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayET());
  const { supabase, householdId, inviteCode } = await requireHousehold();

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", monday)
    .maybeSingle();

  const [{ data: items }, { count: mealCount }] = week
    ? await Promise.all([
        supabase
          .from("shopping_items")
          .select("id, name, qty, unit, category, to_order, manual")
          .eq("week_id", week.id)
          .order("name"),
        supabase
          .from("planned_meals")
          .select("id", { count: "exact", head: true })
          .eq("week_id", week.id),
      ])
    : [{ data: [] }, { count: 0 }];

  const list = items ?? [];
  const toOrder = list.filter((i) => i.to_order).length;
  const groups = CATEGORIES.map((c) => ({
    category: c,
    rows: list.filter((i) => (CATEGORIES.includes(i.category) ? i.category : "other") === c),
  })).filter((g) => g.rows.length);

  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href={`/shopping?w=${addDays(monday, -7)}`} className="rounded border px-2 py-1">
            ←
          </Link>
          <h1 className="text-xl font-bold">Shopping: {weekLabel(monday)}</h1>
          <Link href={`/shopping?w=${addDays(monday, 7)}`} className="rounded border px-2 py-1">
            →
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm">
          <form action={generateList}>
            <input type="hidden" name="week" value={monday} />
            <button className="rounded bg-green-700 px-3 py-1.5 font-medium text-white">
              {list.length ? "Rebuild from this week's meals" : "Build list from this week's meals"}
            </button>
          </form>
          <span className="text-neutral-600">
            {mealCount ?? 0} planned meal{mealCount === 1 ? "" : "s"} · {toOrder} of {list.length} items to
            order
          </span>
        </div>
        {list.length > 0 && (
          <p className="mb-4 text-xs text-neutral-500">
            Checked items will be ordered. Uncheck anything you already have. Rebuilding keeps your
            checkboxes and the items you added yourself.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.category} className="mb-5">
            <h2 className="mb-1 text-sm font-semibold uppercase text-neutral-500">{g.category}</h2>
            <ul className="divide-y rounded-xl border bg-white">
              {g.rows.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <form action={toggleItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="to_order" value={String(i.to_order)} />
                    <button
                      aria-label={i.to_order ? "Don't order" : "Order"}
                      className={`h-6 w-6 rounded border text-xs ${
                        i.to_order ? "bg-green-700 text-white" : "bg-white"
                      }`}
                    >
                      {i.to_order ? "✓" : ""}
                    </button>
                  </form>
                  <span className={i.to_order ? "" : "text-neutral-400 line-through"}>
                    {i.qty != null ? `${i.qty} ` : ""}
                    {i.unit ? `${i.unit} ` : ""}
                    {i.name}
                  </span>
                  {i.manual && <span className="rounded bg-neutral-100 px-1.5 text-xs">added</span>}
                  <form action={deleteItem} className="ml-auto">
                    <input type="hidden" name="id" value={i.id} />
                    <button aria-label="Delete" className="text-neutral-400 hover:text-red-700">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {list.length === 0 && (
          <p className="mb-5 text-neutral-500">
            Nothing here yet. Plan some meals on the This week page, then build the list.
          </p>
        )}

        <form action={addItem} className="flex flex-wrap gap-2 rounded-xl border bg-white p-4 text-sm">
          <input type="hidden" name="week" value={monday} />
          <input name="name" required placeholder="Add an item (milk, paper towels…)" className="min-w-0 flex-1 rounded border px-2 py-1" />
          <input name="qty" type="number" step="any" min="0" placeholder="Qty" className="w-16 rounded border px-2 py-1" />
          <input name="unit" placeholder="Unit" className="w-20 rounded border px-2 py-1" />
          <select name="category" defaultValue="other" className="rounded border px-2 py-1">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="rounded bg-green-700 px-3 py-1 text-white">Add</button>
        </form>
      </main>
    </>
  );
}
