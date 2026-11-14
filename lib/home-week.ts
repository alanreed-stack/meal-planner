// Small decisions the Home page makes about which week to talk about.
import { isPlanningDay } from "./dates";

/** On the last two days of the week (Friday and Saturday), nudge to plan next week when it has fewer than three dinners. */
export function shouldPlanNextWeek(today: string, nextWeekDinners: number): boolean {
  return isPlanningDay(today) && nextWeekDinners < 3;
}

export type GroceryWeek = { weekStart: string; toOrder: number; inCart: number };

/**
 * Which week the Groceries card should show: the first one (this week, then next) that still has something to
 * send. If everything is already in the cart, the first week that has a list. Otherwise this week.
 */
export function groceryFocus(weeks: GroceryWeek[]): GroceryWeek {
  return (
    weeks.find((w) => w.toOrder - w.inCart > 0) ??
    weeks.find((w) => w.toOrder > 0) ??
    weeks[0]
  );
}

export type StatusPart = { text: string; to: "plan" | "shopping" };

/** "5 of 7 dinners planned", "list built", "18 of 24 in cart": each part links to where you can act on it. */
export function weekStatus(w: { dinners: number; listBuilt: boolean; toOrder: number; inCart: number }): StatusPart[] {
  const parts: StatusPart[] = [{ text: `${w.dinners} of 7 dinners planned`, to: "plan" }];
  parts.push({ text: w.listBuilt ? "list built" : "no list yet", to: "shopping" });
  if (w.toOrder > 0) parts.push({ text: `${w.inCart} of ${w.toOrder} in cart`, to: "shopping" });
  return parts;
}

export type QuickCand = {
  id: string;
  name: string;
  diet: "both" | "family" | "keto";
  favorite: boolean;
  minutes: number;
  lastDay: string | null;
};

/**
 * Three quick ideas for tonight: favorites under 30 minutes that have not been made lately. If there are not
 * enough, other quick recipes fill in. The order is stable for a given day, and changes the next day.
 */
export function quickPicks(
  cands: QuickCand[],
  mode: "home" | "travel",
  today: string,
  n = 3
): QuickCand[] {
  const daysSince = (d: string | null) => (d ? (Date.parse(today + "T00:00:00Z") - Date.parse(d + "T00:00:00Z")) / 86_400_000 : 999);
  const fits = cands.filter(
    (c) => c.minutes <= 30 && (mode === "home" ? c.diet !== "family" : c.diet !== "keto") && daysSince(c.lastDay) >= 14
  );
  // A small, well-mixed hash of the recipe and the date, so the same day always gives the same order.
  const hash = (id: string) => {
    let h = 2166136261;
    for (const ch of today + id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return h >>> 0;
  };
  return [...fits]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || hash(a.id) - hash(b.id))
    .slice(0, n);
}
