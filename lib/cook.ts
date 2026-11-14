// Helpers for cook mode: times written in a step, countdown text, and saved progress.

export type FoundTimer = { seconds: number; label: string };

const FRACTION: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
// A number as written in a recipe: 20, 3.5, 1/2, 1 1/2, ½, 1½.
const NUM = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?[½¼¾⅓⅔]?|[½¼¾⅓⅔])`;
const UNIT = String.raw`(seconds?|secs?|minutes?|mins?|hours?|hrs?)`;
const TIME = new RegExp(`(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?\\s*${UNIT}\\b`, "gi");

function parseNum(text: string): number {
  const t = text.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const uni = t.match(/^(\d+(?:\.\d+)?)?([½¼¾⅓⅔])$/);
  if (uni) return (uni[1] ? Number(uni[1]) : 0) + FRACTION[uni[2]];
  return Number(t);
}

/** 90 -> "1 min 30 sec" is avoided on purpose: people say "1 hr 30 min", "20 min", "30 sec". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Times mentioned in one step: "simmer 20 minutes" gives 20 min, "cook 6 to 7 minutes" gives 7 min (the longer one),
 * "Low 6 hours or High 3.5 hours" gives both. Very short and very long times are ignored.
 */
export function findTimers(step: string): FoundTimer[] {
  const out: FoundTimer[] = [];
  const seen = new Set<number>();
  for (const m of step.matchAll(TIME)) {
    const value = Math.max(parseNum(m[1]), m[2] ? parseNum(m[2]) : 0);
    const unit = m[3].toLowerCase();
    const seconds = Math.round(value * (unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1));
    if (!Number.isFinite(seconds) || seconds < 10 || seconds > 24 * 3600 || seen.has(seconds)) continue;
    seen.add(seconds);
    out.push({ seconds, label: formatDuration(seconds) });
  }
  return out;
}

/** 1205 -> "20:05", 3725 -> "1:02:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export type SavedTimer = { id: string; step: number; label: string; endsAt: number };
export type SavedCook = { done: boolean[]; gathered: boolean[]; timers: SavedTimer[]; rated: boolean };

export const cookKey = (recipeId: string, date: string) => `cook:v1:${recipeId}:${date}`;
export const COOK_PREFIX = "cook:v1:";

/** Whether a saved key belongs to another day and can be thrown away. */
export const isOldCookKey = (key: string, today: string) => key.startsWith(COOK_PREFIX) && !key.endsWith(`:${today}`);

const fit = (value: unknown, n: number): boolean[] =>
  Array.from({ length: n }, (_, i) => Array.isArray(value) && value[i] === true);

/** Reads what was saved, and copes with nothing, bad data, or a recipe whose steps changed since. */
export function readCook(raw: string | null, steps: number, ingredients: number): SavedCook {
  const empty: SavedCook = { done: fit(null, steps), gathered: fit(null, ingredients), timers: [], rated: false };
  if (!raw) return empty;
  try {
    const d = JSON.parse(raw) as Partial<SavedCook> | null;
    if (!d || typeof d !== "object") return empty;
    const timers = (Array.isArray(d.timers) ? d.timers : []).filter(
      (t): t is SavedTimer =>
        !!t && typeof t.id === "string" && typeof t.endsAt === "number" && typeof t.label === "string" && typeof t.step === "number"
    );
    return { done: fit(d.done, steps), gathered: fit(d.gathered, ingredients), timers, rated: d.rated === true };
  } catch {
    return empty;
  }
}
