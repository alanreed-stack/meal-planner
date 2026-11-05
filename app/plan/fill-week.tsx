"use client";

import { useState } from "react";
import { Info, Shuffle, Sparkles, Star } from "lucide-react";
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
  const [why, setWhy] = useState(false);

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
              <div className="min-w-0 flex-1 py-1">
                <p className="text-xs text-muted">{labels[d]}</p>
                {c ? (
                  <>
                    <p className="flex items-center gap-1.5 text-base font-medium">
                      {c.favorite && <Star aria-label="Favorite" className="size-4 shrink-0 fill-current text-warning" />}
                      {c.name}
                    </p>
                    <p className="text-xs text-muted tabular-nums">
                      {formatMinutes(c.minutes)}
                      {c.protein !== "none" ? ` · ${c.protein}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-muted">No recipe fits, plan this one by hand.</p>
                )}
              </div>
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
    </Card>
  );
}
