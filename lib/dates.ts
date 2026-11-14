// All dates are plain "YYYY-MM-DD" strings so time zones can't shift a day.

export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Sunday that starts the week containing the given date. Weeks run Sunday through Saturday. */
export function weekStartOf(iso: string): string {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  return addDays(iso, -dow);
}

export function dayLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function weekLabel(weekStart: string): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
}

/** The current time in milliseconds. A function of its own so components can call it from event handlers. */
export const nowMs = () => Date.now();

/** True when a timestamp (ISO string) is already behind us. */
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/** Hour of the day (0-23) in Eastern time, for "good morning / evening". */
export function hourET(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date())
  ) % 24;
}

/**
 * Says how far a week is from the current one: "Next week", "Last week", "In 3 weeks", "2 weeks ago".
 * Null for the current week, so callers only show a label when the week on screen is a different one.
 */
export function weekRelation(weekStart: string, thisWeekStart: string): string | null {
  const weeks = Math.round((Date.parse(weekStart + "T00:00:00Z") - Date.parse(thisWeekStart + "T00:00:00Z")) / (7 * 86_400_000));
  if (weeks === 0) return null;
  if (weeks === 1) return "Next week";
  if (weeks === -1) return "Last week";
  return weeks > 0 ? `In ${weeks} weeks` : `${-weeks} weeks ago`;
}

/** True on Friday and Saturday, the last days of a Sunday-to-Saturday week, when next week is the one to plan. */
export function isPlanningDay(iso: string): boolean {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay();
  return dow === 5 || dow === 6;
}
