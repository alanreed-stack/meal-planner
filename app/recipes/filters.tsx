"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Select } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";

export type FilterState = {
  q: string;
  fav: boolean;
  quick: boolean;
  diet: string; // "", "both", "keto", "family"
  p: string; // meat
  s: string; // sort
  removed: boolean;
};

const PROTEINS = ["chicken", "beef", "pork", "turkey", "shrimp", "fish"];

/**
 * The "Filters" chip. It opens a sheet with the less-used choices: meat, diet, sort, and showing removed recipes.
 * The sheet is a plain form that goes to the same page, so the choices live in the address and can be bookmarked.
 */
export function FiltersSheet({ state, count }: { state: FilterState; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip className="shrink-0" on={count > 0} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal aria-hidden className="size-4" />
        Filters{count > 0 ? ` (${count})` : ""}
      </Chip>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filter recipes">
        <form action="/recipes" method="get" className="flex max-h-[inherit] flex-col">
          {/* Keep the search and the quick chips you already picked. */}
          <input type="hidden" name="q" value={state.q} />
          {state.fav && <input type="hidden" name="fav" value="1" />}
          {state.quick && <input type="hidden" name="quick" value="1" />}

          <div className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-4">
            <h2 className="flex-1 font-semibold">Filters</h2>
            <IconButton label="Close" onClick={() => setOpen(false)}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>

          <div className="space-y-4 overflow-y-auto p-4">
            <Field label="Main meat">
              <Select name="p" defaultValue={state.p}>
                <option value="">Any</option>
                {PROTEINS.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Diet">
              <Select name="diet" defaultValue={state.diet}>
                <option value="">Any</option>
                <option value="both">Keto + family</option>
                <option value="keto">Keto only</option>
                <option value="family">Family only</option>
              </Select>
            </Field>
            <Field label="Sort by">
              <Select name="s" defaultValue={state.s}>
                <option value="name">Name</option>
                <option value="time">Cook time</option>
                <option value="recent">Least recently made</option>
              </Select>
            </Field>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="removed" value="1" defaultChecked={state.removed} className="size-5 accent-primary" />
              Show removed recipes
            </label>
          </div>

          <div className="flex gap-2 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <ButtonLink href={state.q ? `/recipes?q=${encodeURIComponent(state.q)}` : "/recipes"} className="flex-1">
              Clear all
            </ButtonLink>
            <Button type="submit" variant="primary" className="flex-1">
              Show recipes
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
