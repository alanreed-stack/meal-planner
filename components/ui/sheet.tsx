"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A panel over the page: a bottom sheet on phones, a centered dialog on bigger screens.
 * Built on the browser's own <dialog>, which traps keyboard focus inside, closes on Escape,
 * and puts the rest of the page behind it. Content is only rendered while it's open.
 */
export function Sheet({
  open,
  onClose,
  title,
  tall = false,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Read out by screen readers. */
  title: string;
  /** Full height on phones, for pickers with a long list. */
  tall?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // Keep the page behind from scrolling while the sheet is up.
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      // A tap on the dimmed area (the dialog element itself, outside its content) closes it.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none overflow-hidden rounded-t-lg border border-border bg-surface p-0 text-foreground shadow-xl",
        "backdrop:bg-black/50",
        tall ? "h-[92dvh] md:h-[80dvh]" : "max-h-[85dvh] md:h-fit md:max-h-[80dvh]",
        // On bigger screens: pinned to all four edges with auto margins, which centers it.
        "md:inset-0 md:m-auto md:max-w-lg md:rounded-lg",
        className
      )}
    >
      {open && children}
    </dialog>
  );
}
