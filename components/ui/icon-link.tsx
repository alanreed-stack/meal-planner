import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** A square icon-only link, 44x44 or more, that looks like a secondary icon button. */
export function IconLink({ label, className, ...props }: Omit<ComponentProps<typeof Link>, "aria-label"> & { label: string }) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
      {...props}
    />
  );
}
