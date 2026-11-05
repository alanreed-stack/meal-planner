import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function chipStyles(on: boolean, className?: string) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm border px-3 text-sm whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-surface text-foreground hover:bg-surface-muted",
    className
  );
}

/** A toggle filter. */
export function Chip({
  on = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return <button type={type} aria-pressed={on} className={chipStyles(on, className)} {...props} />;
}

/** A filter that is a link (the choice lives in the page address). */
export function ChipLink({ on = false, className, ...props }: ComponentProps<typeof Link> & { on?: boolean }) {
  return <Link aria-current={on ? "true" : undefined} className={chipStyles(on, className)} {...props} />;
}
