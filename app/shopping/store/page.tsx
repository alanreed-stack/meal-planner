import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { mondayOf, todayET, weekLabel } from "@/lib/dates";
import { formatIngredient } from "@/lib/format";
import { resetPicked } from "../actions";
import { StoreList, type StoreItem } from "./store-list";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = { title: "In-store list" };

const CATEGORIES = ["produce", "meat", "dairy", "bakery", "frozen", "pantry", "other"];

export default async function StorePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const monday = mondayOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayET());
  const { supabase, householdId } = await requireHousehold();

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", monday)
    .maybeSingle();
  const { data: rows } = week
    ? await supabase
        .from("shopping_items")
        .select("id, name, qty, unit, category, picked, sent_at, kroger_size, order_qty")
        .eq("week_id", week.id)
        .eq("to_order", true)
    : { data: [] };

  const items: StoreItem[] = (rows ?? []).map((i) => ({
    id: i.id,
    text: formatIngredient(i.qty == null ? null : Number(i.qty), i.unit, i.name),
    category: CATEGORIES.includes(i.category) ? i.category : "other",
    picked: i.picked,
    inCart: !!i.sent_at,
  }));

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl bg-background px-4 pb-20">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
        <ButtonLink href={`/shopping?w=${monday}`} size="sm">
          <ArrowLeft aria-hidden className="size-4" /> Back
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">In-store list</h1>
          <p className="text-xs text-muted tabular-nums">{weekLabel(monday)}</p>
        </div>
        <form action={resetPicked}>
          <input type="hidden" name="week" value={monday} />
          <SubmitButton variant="ghost" size="sm">
            Start over
          </SubmitButton>
        </form>
      </header>
      <StoreList items={items} order={CATEGORIES} />
    </div>
  );
}
