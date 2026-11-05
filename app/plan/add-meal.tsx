"use client";

import { useMemo, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import { addMeal } from "./actions";
import { formatMinutes } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Select } from "@/components/ui/field";
import { FormBusy } from "@/components/ui/form-busy";
import { IconButton } from "@/components/ui/icon-button";
import { RowButton } from "@/components/ui/row-button";
import { SubmitButton } from "@/components/ui/submit-button";

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
      <Button className="mt-3" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" /> Add meal
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await addMeal(formData);
        setOpen(false);
        setQ("");
      }}
      className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-sm"
    >
      <FormBusy label="Adding…">
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="day" value={day} />
      <div className="mb-2 flex items-center gap-2">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes…"
          aria-label="Search recipes"
          className="w-full min-w-0 flex-1"
        />
        <Select name="slot" defaultValue="dinner" aria-label="Meal" className="w-auto">
          {SLOTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <IconButton label="Close" onClick={() => setOpen(false)}>
          <X aria-hidden className="size-5" />
        </IconButton>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <Chip on={fav} onClick={() => setFav(!fav)}>
          <Star aria-hidden className="size-4" /> Favorites
        </Chip>
        <Chip on={quick} onClick={() => setQuick(!quick)}>
          Quick (30 min or less)
        </Chip>
        <Chip on={both} onClick={() => setBoth(!both)}>
          Keto + family
        </Chip>
        {PROTEINS.map((p) => (
          <Chip key={p} on={protein === p} onClick={() => setProtein(protein === p ? null : p)}>
            {p}
          </Chip>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
        <span className="mr-1 text-xs text-muted">Not cooking:</span>
        <SubmitButton name="kind" value="leftovers" size="sm">
          Leftovers
        </SubmitButton>
        <SubmitButton name="kind" value="out" size="sm">
          Eating out
        </SubmitButton>
        <SubmitButton name="kind" value="quick" size="sm">
          Sports night (quick)
        </SubmitButton>
      </div>

      <ul className="max-h-72 overflow-auto rounded-sm border border-border bg-surface">
        {shown.map((r) => (
          <li key={r.id} className="border-b border-border last:border-b-0">
            <RowButton
              type="submit"
              name="recipe_id"
              value={r.id}
              className="block min-h-11 w-full px-2 py-2 text-left hover:bg-primary-soft"
            >
              <span className="flex items-center gap-1">
                {r.f && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
                {r.n}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted tabular-nums">
                <span>
                  {formatMinutes(r.m)}
                  {ago(r.w) ? ` · ${ago(r.w)}` : ""}
                </span>
                {mode === "home" && r.d === "family" && <Badge tone="diet-family">family only</Badge>}
              </span>
            </RowButton>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-3 text-muted">No recipes match.</li>}
      </ul>
      </FormBusy>
    </form>
  );
}
