"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import { addMeal } from "./actions";
import { formatMinutes } from "@/lib/format";
import { seededRng, suggestFor } from "@/lib/autofill";
import { RecipeThumb } from "@/app/recipes/recipe-thumb";
import { usePlanInput } from "./plan-context";
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
  img: string | null; // photo
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
  defaultOpen = false,
}: {
  week: string;
  day: string;
  dayName: string;
  mode: "home" | "travel";
  recipes: PickerRecipe[];
  /** Open as soon as the page loads (the "Plan tonight" link on Home). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button className="mt-3 lg:w-full lg:px-2" onClick={() => setOpen(true)}>
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

  // On a computer the search box is ready to type in. On a phone it would pop the keyboard up over the list.
  const searchRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) searchRow.current?.querySelector("input")?.focus();
  }, []);

  // Four ideas for this day, picked with the same rules as "fill the week". Seeded, so it is steady for the day.
  const input = usePlanInput();
  const suggested = useMemo(() => {
    if (!input) return [];
    const byId = new Map(recipes.map((r) => [r.id, r]));
    return suggestFor(input, day, 4, seededRng(`${week}|${day}`))
      .map((c) => byId.get(c.id))
      .filter((r): r is PickerRecipe => !!r);
  }, [input, recipes, week, day]);
  const filtering = q.trim() !== "" || fav || quick || both || protein !== null;

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
          <div ref={searchRow} className="flex gap-2">
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {!filtering && suggested.length > 0 && (
            <section aria-label="Suggested">
              <h3 className="bg-surface-muted px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase">Suggested</h3>
              <ul>
                {suggested.map((r) => (
                  <li key={r.id} className="border-b border-border">
                    <PickRow r={r} mode={mode} />
                  </li>
                ))}
              </ul>
              <h3 className="bg-surface-muted px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase">All recipes</h3>
            </section>
          )}
          <ul>
            {shown.map((r) => (
              <li key={r.id} className="border-b border-border last:border-b-0">
                <PickRow r={r} mode={mode} />
              </li>
            ))}
            {shown.length === 0 && <li className="px-4 py-6 text-center text-muted">No recipes match.</li>}
          </ul>
        </div>
      </FormBusy>
    </form>
  );
}

/** One recipe in the picker: tap anywhere on the row to add it. */
function PickRow({ r, mode }: { r: PickerRecipe; mode: "home" | "travel" }) {
  return (
    <RowButton
      type="submit"
      name="recipe_id"
      value={r.id}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-primary-soft"
    >
      <RecipeThumb image={r.img} protein={r.p} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-base">
          {r.f && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
          <span className="truncate">{r.n}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted tabular-nums">
          <span>
            {formatMinutes(r.m)}
            {ago(r.w) ? ` · ${ago(r.w)}` : ""}
          </span>
          {mode === "home" && r.d === "family" && <Badge tone="diet-family">family only</Badge>}
        </span>
      </span>
    </RowButton>
  );
}
