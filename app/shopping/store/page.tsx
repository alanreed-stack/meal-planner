import { CATEGORIES } from "@/lib/categories";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { weekStartOf, todayET, weekLabel } from "@/lib/dates";
import { formatIngredient } from "@/lib/format";
import { StoreList, type StoreItem } from "./store-list";

export const metadata: Metadata = { title: "In-store list" };


export default async function StorePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const weekStart = weekStartOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayET());
  const { supabase, householdId } = await requireHousehold();

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  const { data: rows } = week
    ? await supabase
        .from("shopping_items")
        .select("id, name, qty, unit, category, picked, sent_at, kroger_description, kroger_aisle, order_qty")
        .eq("week_id", week.id)
        .eq("to_order", true)
    : { data: [] };

  const items: StoreItem[] = (rows ?? []).map((i) => ({
    id: i.id,
    text: formatIngredient(i.qty == null ? null : Number(i.qty), i.unit, i.name),
    category: CATEGORIES.includes(i.category) ? i.category : "other",
    picked: i.picked,
    inCart: !!i.sent_at,
    product: i.kroger_description ? `${i.order_qty} × ${i.kroger_description.replace(/ · /g, " ")}` : null,
    aisle: i.kroger_aisle,
  }));

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl bg-background px-4 pb-20">
      <StoreList items={items} order={CATEGORIES} weekId={week?.id ?? null} weekStart={weekStart} weekText={weekLabel(weekStart)} />
    </div>
  );
}
