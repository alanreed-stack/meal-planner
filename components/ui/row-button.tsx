import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A full-width tappable row (a checklist item, a step). Looks like whatever className gives it. */
export function RowButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
      {...props}
    />
  );
}
