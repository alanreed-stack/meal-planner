"use client";

import { useState } from "react";
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
      <button
        type="button"
        onClick={() => toggle(i.id)}
        aria-pressed={done}
        className="flex min-h-14 w-full items-center gap-4 border-b px-1 py-2 text-left"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 text-xl ${
            done ? "border-green-600 bg-green-600 text-white" : "border-neutral-400"
          }`}
        >
          {done ? "✓" : ""}
        </span>
        <span className={`flex-1 text-xl ${done ? "text-neutral-400 line-through" : ""}`}>{i.text}</span>
        {i.inCart && (
          <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">in Kroger cart</span>
        )}
      </button>
    </li>
  );

  return (
    <div className="mt-3">
      <label className="mb-3 flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" checked={hideCart} onChange={(e) => setHideCart(e.target.checked)} />
        Hide items already in my Kroger cart
      </label>

      {items.length === 0 && <p className="mt-6 text-neutral-500">Nothing to buy. Build the list on the Shopping page first.</p>}

      {byCategory.map((g) => (
        <section key={g.c} className="mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-neutral-500">{g.c}</h2>
          <ul>{g.rows.map((i) => row(i, false))}</ul>
        </section>
      ))}

      {open.length === 0 && visible.length > 0 && (
        <p className="my-6 rounded-xl bg-green-50 p-4 text-center text-lg font-semibold">Everything&apos;s in the cart 🎉</p>
      )}

      {got.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-semibold uppercase text-neutral-500">Got it ({got.length})</h2>
          <ul>{got.map((i) => row(i, true))}</ul>
        </section>
      )}
    </div>
  );
}
