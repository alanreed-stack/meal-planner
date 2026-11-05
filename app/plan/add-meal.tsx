"use client";

import { useMemo, useState } from "react";
import { addMeal } from "./actions";
import { formatMinutes } from "@/lib/format";

export type PickerRecipe = {
  id: string;
  n: string; // name
  d: "both" | "family" | "keto";
  f: boolean; // favorite
  m: number; // total minutes
  p: string; // main protein
  w: number | null; // weeks since last planned (before this week)
};

const PROTEINS = ["chicken", "beef", "shrimp", "fish", "pork", "turkey"];
const SLOTS = ["dinner", "lunch", "breakfast"];

function ago(w: number | null) {
  if (w == null) return null;
  return w <= 1 ? "last week" : `${w} weeks ago`;
}

export function AddMeal({
  week,
  day,
  mode,
  recipes,
}: {
  week: string;
  day: string;
  mode: "home" | "travel";
  recipes: PickerRecipe[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [fav, setFav] = useState(false);
  const [quick, setQuick] = useState(false);
  const [both, setBoth] = useState(false);
  const [protein, setProtein] = useState<string | null>(null);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = recipes.filter(
      (r) =>
        (!term || r.n.toLowerCase().includes(term)) &&
        (!fav || r.f) &&
        (!quick || r.m <= 30) &&
        (!both || r.d === "both") &&
        (!protein || r.p === protein)
    );
    // In a home week, family-only meals sink to the bottom (they need a keto plate too).
    const pushDown = (r: PickerRecipe) => (mode === "home" && r.d === "family" ? 1 : 0);
    return list.sort(
      (a, b) => pushDown(a) - pushDown(b) || Number(b.f) - Number(a.f) || a.n.localeCompare(b.n)
    );
  }, [recipes, q, fav, quick, both, protein, mode]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded border px-3 py-1 text-sm hover:bg-neutral-50"
      >
        + Add meal
      </button>
    );
  }

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-xs ${on ? "bg-green-700 text-white" : "bg-white"}`;

  return (
    <form
      action={async (formData) => {
        await addMeal(formData);
        setOpen(false);
        setQ("");
      }}
      className="mt-3 rounded-lg border bg-neutral-50 p-3 text-sm"
    >
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="day" value={day} />
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes…"
          className="w-full min-w-0 flex-1 rounded border px-2 py-1"
        />
        <select name="slot" defaultValue="dinner" className="rounded border px-2 py-1" aria-label="Meal">
          {SLOTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button type="button" onClick={() => setOpen(false)} className="text-neutral-500" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" className={chip(fav)} onClick={() => setFav(!fav)}>
          ★ Favorites
        </button>
        <button type="button" className={chip(quick)} onClick={() => setQuick(!quick)}>
          Quick (30 min or less)
        </button>
        <button type="button" className={chip(both)} onClick={() => setBoth(!both)}>
          Keto + family
        </button>
        {PROTEINS.map((p) => (
          <button
            key={p}
            type="button"
            className={chip(protein === p)}
            onClick={() => setProtein(protein === p ? null : p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5 border-b pb-2">
        <span className="mr-1 text-xs text-neutral-500">Not cooking:</span>
        <button name="kind" value="leftovers" className="rounded border bg-white px-2.5 py-0.5 text-xs">
          Leftovers
        </button>
        <button name="kind" value="out" className="rounded border bg-white px-2.5 py-0.5 text-xs">
          Eating out
        </button>
        <button name="kind" value="quick" className="rounded border bg-white px-2.5 py-0.5 text-xs">
          Sports night (quick)
        </button>
      </div>

      <ul className="max-h-72 overflow-auto rounded border bg-white">
        {shown.map((r) => (
          <li key={r.id} className="border-b last:border-b-0">
            <button
              name="recipe_id"
              value={r.id}
              className="block min-h-11 w-full px-2 py-2 text-left hover:bg-green-50"
            >
              <span className="block">
                {r.f && <span className="mr-1 text-amber-500">★</span>}
                {r.n}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                <span>
                  {formatMinutes(r.m)}
                  {ago(r.w) ? ` · ${ago(r.w)}` : ""}
                </span>
                {mode === "home" && r.d === "family" && (
                  <span className="rounded bg-amber-100 px-1.5 text-neutral-800">family only</span>
                )}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-3 text-neutral-500">No recipes match.</li>}
      </ul>
    </form>
  );
}
