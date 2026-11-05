import { Nav } from "./nav";
import { cn } from "@/lib/cn";

export const Bar = ({ className = "" }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />
);

/** Placeholder shown while a page loads: the real header and tab bar, then grey blocks. */
export function PageSkeleton({ title, rows = 4, rowHeight = "h-24" }: { title: string; rows?: number; rowHeight?: string }) {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6" aria-busy="true" aria-label={`Loading ${title}`}>
        <Bar className="h-7 w-48" />
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} className={`${rowHeight} w-full`} />
        ))}
      </main>
    </>
  );
}
