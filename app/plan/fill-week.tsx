"use client";

import { useState } from "react";
import { keepFill } from "./actions";
import { proposeFill, reshuffleDay, type Cand, type FillInput } from "@/lib/autofill";
import { formatMinutes } from "@/lib/format";

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
      <button
        type="button"
        onClick={() => setDraft(proposeFill(input, emptyDays))}
        className="mb-5 rounded-lg border border-green-700 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50"
      >
        ✨ Fill the rest of the week ({emptyDays.length} open dinner{emptyDays.length === 1 ? "" : "s"})
      </button>
    );
  }

  const picks = emptyDays
    .filter((d) => draft[d])
    .map((d) => ({ day: d, recipe_id: draft[d]!.id }));

  return (
    <section className="mb-5 rounded-xl border-2 border-green-700 bg-green-50 p-4 text-sm">
      <h2 className="font-semibold">Suggested dinners (nothing is saved yet)</h2>
      <ul className="mt-2 divide-y rounded border bg-white">
        {emptyDays.map((d) => {
          const c = draft[d];
          return (
            <li key={d} className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-24 shrink-0 text-xs text-neutral-500">{labels[d]}</span>
              <span className="min-w-0 flex-1">
                {c ? (
                  <>
                    {c.favorite && <span className="mr-1 text-amber-500">★</span>}
                    {c.name}
                    <span className="ml-2 text-xs text-neutral-500">
                      {formatMinutes(c.minutes)}
                      {c.protein !== "none" ? ` · ${c.protein}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-neutral-500">No recipe fits, plan this one by hand.</span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Shuffle ${labels[d]}`}
                title="Pick a different one"
                onClick={() => setDraft({ ...draft, [d]: reshuffleDay(input, draft, d) })}
                className="rounded border px-2 py-0.5"
              >
                🔀
              </button>
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
          <button
            disabled={picks.length === 0}
            className="rounded bg-green-700 px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            Keep these
          </button>
        </form>
        <button
          type="button"
          onClick={() => setDraft(proposeFill(input, emptyDays))}
          className="rounded border bg-white px-3 py-1.5"
        >
          Start over
        </button>
        <button type="button" onClick={() => setDraft(null)} className="rounded px-3 py-1.5 underline">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-600">
        Skips anything you&apos;ve had in the last 3 weeks, avoids the same meat two nights in a row, and leans
        toward your favorites.{" "}
        {input.mode === "home" ? "Family-only meals are left out of home weeks." : "Keto-only meals are left out of travel weeks."}
      </p>
    </section>
  );
}
