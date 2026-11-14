// Small reminders about tomorrow's dinner, shown on Home the evening before.
import { clockBefore } from "./format";

export type TomorrowMeal = {
  name: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  /** The main meat, or "none". */
  protein: string;
};

/** A slow cooker meal, or anything that cooks for two hours or more. */
export function isLongCook(m: Pick<TomorrowMeal, "cookMinutes" | "tags">): boolean {
  return (m.cookMinutes ?? 0) >= 120 || m.tags.includes("slow-cooker");
}

export function headsUp(m: TomorrowMeal, dinnerTime: string, thawReminder: boolean): string[] {
  const out: string[] = [];
  if (isLongCook(m)) {
    const total = (m.prepMinutes ?? 0) + (m.cookMinutes ?? 0);
    out.push(`Tomorrow: start ${m.name} by ${clockBefore(dinnerTime, total)}.`);
  }
  if (thawReminder && m.protein !== "none") {
    out.push(`Tomorrow's ${m.protein}: if it is frozen, move it to the fridge tonight.`);
  }
  return out;
}
