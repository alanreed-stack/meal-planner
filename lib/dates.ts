// All dates are plain "YYYY-MM-DD" strings so time zones can't shift a day.

export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given date. */
export function mondayOf(iso: string): string {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export function dayLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function weekLabel(monday: string): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(monday)} – ${fmt(addDays(monday, 6))}`;
}

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
