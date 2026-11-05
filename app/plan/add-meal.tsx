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
import { Sheet } from "@/components/ui/sheet";
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

function ago(w: number | null) {
  if (w == null) return null;
  return w <= 1 ? "last week" : `${w} weeks ago`;
}

/**
 * "Add meal" button for one day. It opens a full-height bottom sheet on a phone (a dialog on a bigger screen)
 * with search, filter chips, the "not cooking" options and the recipe list.
 */
export function AddMeal({
  week,
  day,
  dayName,
  mode,
  recipes,
}: {
  week: string;
  day: string;
  dayName: string;
  mode: "home" | "travel";
  recipes: PickerRecipe[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="mt-3" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" /> Add meal
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Add a meal for ${dayName}`} tall>
        <Picker week={week} day={day} dayName={dayName} mode={mode} recipes={recipes} close={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function Picker({
  week,
  day,
  dayName,
  mode,
  recipes,
  close,
}: {
  week: string;
  day: string;
  dayName: string;
  mode: "home" | "travel";
  recipes: PickerRecipe[];
  close: () => void;
}) {
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

  return (
    <form
      action={async (formData) => {
        await addMeal(formData);
        close();
      }}
      className="flex h-full max-h-[inherit] flex-col"
    >
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="day" value={day} />
      <FormBusy label="Adding…">
        <div className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-4">
          <h2 className="flex-1 truncate font-semibold">Add to {dayName}</h2>
          <IconButton label="Close" onClick={close}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>

        <div className="space-y-3 border-b border-border p-3">
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search recipes…"
              aria-label="Search recipes"
              className="min-w-0 flex-1"
            />
            <Select name="slot" defaultValue="dinner" aria-label="Meal" className="w-auto">
              <option value="dinner">Dinner</option>
              <option value="lunch">Lunch</option>
              <option value="breakfast">Breakfast</option>
            </Select>
          </div>

          {/* One row of filters that scrolls sideways, so it never eats the screen. */}
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
            <Chip className="shrink-0" on={fav} onClick={() => setFav(!fav)}>
              <Star aria-hidden className="size-4" /> Favorites
            </Chip>
            <Chip className="shrink-0" on={quick} onClick={() => setQuick(!quick)}>
              Quick
            </Chip>
            <Chip className="shrink-0" on={both} onClick={() => setBoth(!both)}>
              Keto + family
            </Chip>
            {PROTEINS.map((p) => (
              <Chip key={p} className="shrink-0" on={protein === p} onClick={() => setProtein(protein === p ? null : p)}>
                {p}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Not cooking:</span>
            <SubmitButton name="kind" value="leftovers" size="sm">
              Leftovers
            </SubmitButton>
            <SubmitButton name="kind" value="out" size="sm">
              Eating out
            </SubmitButton>
            <SubmitButton name="kind" value="quick" size="sm">
              Sports night
            </SubmitButton>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {shown.map((r) => (
            <li key={r.id} className="border-b border-border last:border-b-0">
              <RowButton
                type="submit"
                name="recipe_id"
                value={r.id}
                className="block min-h-14 w-full px-4 py-3 text-left hover:bg-primary-soft"
              >
                <span className="flex items-center gap-1.5 text-base">
                  {r.f && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
                  {r.n}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted tabular-nums">
                  <span>
                    {formatMinutes(r.m)}
                    {ago(r.w) ? ` · ${ago(r.w)}` : ""}
                  </span>
                  {mode === "home" && r.d === "family" && <Badge tone="diet-family">family only</Badge>}
                </span>
              </RowButton>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-6 text-center text-muted">No recipes match.</li>}
        </ul>
      </FormBusy>
    </form>
  );
}
