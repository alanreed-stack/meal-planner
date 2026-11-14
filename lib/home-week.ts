// Small decisions the Home page makes about which week to talk about.
import { isWeekendDay } from "./dates";

/** From Saturday on, nudge to plan next week when it has fewer than three dinners. */
export function shouldPlanNextWeek(today: string, nextWeekDinners: number): boolean {
  return isWeekendDay(today) && nextWeekDinners < 3;
}

export type GroceryWeek = { monday: string; toOrder: number; inCart: number };

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
