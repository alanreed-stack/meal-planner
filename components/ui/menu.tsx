"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { useIsPhone } from "@/lib/use-is-phone";
import { IconButton } from "./icon-button";
import { Sheet } from "./sheet";

/**
 * A "⋯" button that opens a menu: a small popover on a computer, a bottom sheet on a phone.
 * Anything inside with a `data-menu-close` attribute closes the menu when tapped.
 */
export function Menu({
  label,
  title,
  icon,
  children,
}: {
  label: string;
  title?: string;
  /** Replaces the default ⋯ icon. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const phone = useIsPhone();
  const box = useRef<HTMLDivElement>(null);

  // Popover only: close on Escape or a tap outside.
  useEffect(() => {
    if (!open || phone) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, phone]);

  const body = (
    <div
      onClick={(e) => {
        // Wait a beat so a tapped submit button still sends its form before the menu goes away.
        if ((e.target as HTMLElement).closest("[data-menu-close]")) setTimeout(() => setOpen(false), 60);
      }}
    >
      {children}
    </div>
  );

  return (
    <div ref={box} className="relative">
      <IconButton label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} compact>
        {icon ?? <MoreHorizontal aria-hidden className="size-5" />}
      </IconButton>

      {phone ? (
        <Sheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
          <div className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-4">
            <h2 className="flex-1 truncate font-semibold">{title ?? label}</h2>
            <IconButton label="Close" onClick={() => setOpen(false)}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>
          <div className="max-h-[70dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{body}</div>
        </Sheet>
      ) : (
        open && (
          <div
            role="dialog"
            aria-label={title ?? label}
            className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-border bg-surface p-3 shadow-lg"
          >
            {body}
          </div>
        )
      )}
    </div>
  );
}
