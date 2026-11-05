"use client";

import { useState } from "react";
import { Check, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { RowButton } from "@/components/ui/row-button";
import { cn } from "@/lib/cn";
import { setPicked } from "../actions";

export type StoreItem = {
  id: string;
  text: string;
  category: string;
  picked: boolean;
  inCart: boolean;
};

export function StoreList({ items, order }: { items: StoreItem[]; order: string[] }) {
  const [picked, setPickedState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.picked]))
  );
  const [hideCart, setHideCart] = useState(false);

  function toggle(id: string) {
    const next = !picked[id];
    setPickedState((p) => ({ ...p, [id]: next })); // instant
    setPicked(id, next).catch(() => setPickedState((p) => ({ ...p, [id]: !next }))); // undo if it didn't save
  }

  const visible = items.filter((i) => !(hideCart && i.inCart));
  const open = visible.filter((i) => !picked[i.id]);
  const got = visible.filter((i) => picked[i.id]);
  const byCategory = order
    .map((c) => ({ c, rows: open.filter((i) => i.category === c).sort((a, b) => a.text.localeCompare(b.text)) }))
    .filter((g) => g.rows.length);

  const row = (i: StoreItem, done: boolean) => (
    <li key={i.id}>
      <RowButton
        onClick={() => toggle(i.id)}
        aria-pressed={done}
        className="flex min-h-14 w-full items-center gap-4 border-b border-border px-1 py-2 text-left"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-sm border-2",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted"
          )}
        >
          {done && <Check aria-hidden className="size-6" />}
        </span>
        <span className={cn("flex-1 text-xl tabular-nums", done && "text-muted line-through")}>{i.text}</span>
        {i.inCart && <Badge tone="success">in Kroger cart</Badge>}
      </RowButton>
    </li>
  );

  return (
    <div className="mt-3">
      <label className="mb-3 flex min-h-11 items-center gap-3 text-sm text-muted">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={hideCart}
          onChange={(e) => setHideCart(e.target.checked)}
        />
        Hide items already in my Kroger cart
      </label>

      {items.length === 0 && (
        <EmptyState title="Nothing to buy">Build the list on the Shopping page first.</EmptyState>
      )}

      {byCategory.map((g) => (
        <section key={g.c} className="mb-4">
          <h2 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">{g.c}</h2>
          <ul>{g.rows.map((i) => row(i, false))}</ul>
        </section>
      ))}

      {open.length === 0 && visible.length > 0 && (
        <EmptyState icon={<PartyPopper aria-hidden className="size-8" />} title="Everything's in the cart" className="my-6" />
      )}

      {got.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Got it ({got.length})</h2>
          <ul>{got.map((i) => row(i, true))}</ul>
        </section>
      )}
    </div>
  );
}
