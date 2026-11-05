"use client";

import { useState } from "react";
import { Shuffle, Sparkles, Star } from "lucide-react";
import { keepFill } from "./actions";
import { proposeFill, reshuffleDay, type Cand, type FillInput } from "@/lib/autofill";
import { formatMinutes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <h2 className="font-semibold">Suggested dinners (nothing is saved yet)</h2>
      <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-surface">
        {emptyDays.map((d) => {
          const c = draft[d];
          return (
            <li key={d} className="flex items-center gap-2 py-1 pl-2 pr-1">
              <span className="w-24 shrink-0 text-xs text-muted">{labels[d]}</span>
              <span className="min-w-0 flex-1">
                {c ? (
                  <>
                    {c.favorite && (
                      <Star aria-label="Favorite" className="mr-1 inline size-4 fill-current text-warning" />
                    )}
                    {c.name}
                    <span className="ml-2 text-xs text-muted tabular-nums">
                      {formatMinutes(c.minutes)}
                      {c.protein !== "none" ? ` · ${c.protein}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">No recipe fits, plan this one by hand.</span>
                )}
              </span>
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
      <div className="mt-3 flex flex-wrap gap-2">
        <form
          action={async (fd) => {
            await keepFill(fd);
            setDraft(null);
          }}
        >
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="picks" value={JSON.stringify(picks)} />
          <SubmitButton variant="primary" disabled={picks.length === 0}>
            Keep these
          </SubmitButton>
        </form>
        <Button onClick={() => setDraft(proposeFill(input, emptyDays))}>Start over</Button>
        <Button variant="ghost" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Skips anything you&apos;ve had in the last 3 weeks, avoids the same meat two nights in a row, and leans
        toward your favorites.{" "}
        {input.mode === "home" ? "Family-only meals are left out of home weeks." : "Keto-only meals are left out of travel weeks."}
      </p>
    </Card>
  );
}
