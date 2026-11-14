"use client";

import { useMemo, useState } from "react";
import { Info, Pencil, Shuffle, Sparkles, Star, X } from "lucide-react";
import { keepFill } from "./actions";
import { proposeFill, reshuffleDay, type Cand, type FillInput } from "@/lib/autofill";
import { formatMinutes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { RowButton } from "@/components/ui/row-button";
import { Sheet } from "@/components/ui/sheet";
import { IconButton } from "@/components/ui/icon-button";
import { SubmitButton } from "@/components/ui/submit-button";

export function FillWeek({
  week,
  input,
  emptyDays,
  labels,
}: {
  week: string;
  input: FillInput;
  emptyDays: string[];
  labels: Record<string, string>;
}) {
  const [draft, setDraft] = useState<Record<string, Cand | null> | null>(null);
  const [why, setWhy] = useState(false);
  // The day whose dinner is being chosen by hand, and what is typed in that picker's search box.
  const [picking, setPicking] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const choices = useMemo(() => {
    if (!picking || !draft) return [];
    const taken = new Set(
      [...Object.entries(draft).filter(([d]) => d !== picking).map(([, c]) => c?.id), ...Object.values(input.existing).map((e) => e.id)].filter(Boolean)
    );
    const term = q.trim().toLowerCase();
    return input.cands
      .filter((c) => !taken.has(c.id) && (!term || c.name.toLowerCase().includes(term)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  }, [picking, draft, input, q]);

  if (emptyDays.length === 0) return null;

  if (!draft) {
    return (
      <Button className="mb-5" onClick={() => setDraft(proposeFill(input, emptyDays))}>
        <Sparkles aria-hidden className="size-4" />
        Fill the rest of the week ({emptyDays.length} open dinner{emptyDays.length === 1 ? "" : "s"})
      </Button>
    );
  }

  const picks = emptyDays
    .filter((d) => draft[d])
    .map((d) => ({ day: d, recipe_id: draft[d]!.id }));

  return (
    <Card as="section" tone="accent" className="mb-5 text-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h2 className="font-semibold">Suggested dinners</h2>
          <p className="text-muted">Nothing is saved until you tap Keep.</p>
        </div>
        <IconButton
          label="How these are picked"
          aria-expanded={why}
          pressed={why}
          onClick={() => setWhy(!why)}
          className="-mt-1 -mr-1"
        >
          <Info aria-hidden className="size-5" />
        </IconButton>
      </div>
      {why && (
        <p className="mt-2 rounded-md bg-surface p-3 text-muted">
          Skips anything you&apos;ve had in the last 3 weeks, avoids the same meat two nights in a row, and leans
          toward your favorites.{" "}
          {input.mode === "home"
            ? "Family-only meals are left out of home weeks."
            : "Keto-only meals are left out of travel weeks."}
        </p>
      )}

      <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
        {emptyDays.map((d) => {
          const c = draft[d];
          return (
            <li key={d} className="flex items-center gap-2 py-1 pr-1 pl-3">
              <RowButton
                type="button"
                onClick={() => {
                  setQ("");
                  setPicking(d);
                }}
                aria-label={`Choose a recipe for ${labels[d]}${c ? `, now ${c.name}` : ""}`}
                className="min-h-14 min-w-0 flex-1 rounded-md py-1 text-left hover:bg-primary-soft"
              >
                <span className="block text-xs text-muted">{labels[d]}</span>
                {c ? (
                  <>
                    <span className="flex items-center gap-1.5 text-base font-medium">
                      {c.favorite && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
                      {c.name}
                      <Pencil aria-hidden className="size-3.5 shrink-0 text-muted" />
                    </span>
                    <span className="block text-xs text-muted tabular-nums">
                      {formatMinutes(c.minutes)}
                      {c.protein !== "none" ? ` · ${c.protein}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="block text-muted">No recipe fits. Tap to choose one.</span>
                )}
              </RowButton>
              <IconButton
                label={`Pick a different one for ${labels[d]}`}
                variant="secondary"
                onClick={() => setDraft({ ...draft, [d]: reshuffleDay(input, draft, d) })}
              >
                <Shuffle aria-hidden className="size-5" />
              </IconButton>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
        <form
          className="sm:flex-1"
          action={async (fd) => {
            await keepFill(fd);
            setDraft(null);
          }}
        >
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="picks" value={JSON.stringify(picks)} />
          <SubmitButton variant="primary" size="lg" className="w-full" disabled={picks.length === 0}>
            Keep these {picks.length} dinner{picks.length === 1 ? "" : "s"}
          </SubmitButton>
        </form>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setDraft(proposeFill(input, emptyDays))}>
            Start over
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      </div>

      <Sheet open={picking !== null} onClose={() => setPicking(null)} title={`Choose a dinner for ${picking ? labels[picking] : ""}`} tall>
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-4">
            <h2 className="flex-1 truncate font-semibold">Dinner for {picking ? labels[picking] : ""}</h2>
            <IconButton label="Close" onClick={() => setPicking(null)}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>
          <div className="border-b border-border p-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search recipes…"
              aria-label="Search recipes"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {choices.map((c) => (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <RowButton
                  type="button"
                  onClick={() => {
                    if (picking) setDraft({ ...draft!, [picking]: c });
                    setPicking(null);
                  }}
                  className="block min-h-14 w-full px-4 py-3 text-left hover:bg-primary-soft"
                >
                  <span className="flex items-center gap-1.5 text-base">
                    {c.favorite && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
                    {c.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted tabular-nums">
                    <span>
                      {formatMinutes(c.minutes)}
                      {c.protein !== "none" ? ` · ${c.protein}` : ""}
                    </span>
                    {input.mode === "home" && c.diet === "family" && <Badge tone="diet-family">family only</Badge>}
                    {input.mode === "travel" && c.diet === "keto" && <Badge tone="diet-keto">keto only</Badge>}
                  </span>
                </RowButton>
              </li>
            ))}
            {choices.length === 0 && <li className="px-4 py-6 text-center text-muted">No recipes match.</li>}
          </ul>
        </div>
      </Sheet>
    </Card>
  );
}
