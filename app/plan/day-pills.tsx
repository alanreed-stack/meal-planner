import { cn } from "@/lib/cn";

/**
 * Phones only: a row of seven day buttons that sticks to the top while you scroll the week.
 * Tapping one jumps to that day. A dot means a dinner is planned. No JavaScript needed: they're plain links.
 */
export function DayPills({
  days,
  today,
  planned,
}: {
  days: string[];
  today: string;
  planned: Set<string>;
}) {
  return (
    <nav
      aria-label="Jump to a day"
      className="sticky top-0 z-20 -mx-4 mb-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const date = new Date(d + "T00:00:00Z");
          const dow = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
          const num = date.getUTCDate();
          const isToday = d === today;
          const has = planned.has(d);
          return (
            <li key={d}>
              <a
                href={`#day-${d}`}
                aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}${isToday ? ", today" : ""}${has ? ", dinner planned" : ""}`}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-md border text-xs",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isToday ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-border bg-surface text-muted"
                )}
              >
                <span>{dow}</span>
                <span className="text-base leading-none tabular-nums">{num}</span>
                <span
                  aria-hidden
                  className={cn("mt-1 size-1.5 rounded-full", has ? (isToday ? "bg-primary-ink" : "bg-primary") : "bg-transparent")}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
