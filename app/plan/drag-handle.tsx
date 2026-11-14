"use client";

import { GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { moveMealTo } from "./actions";

// Highlight for the day a meal would land on. Added and removed directly on the page, so dragging stays smooth.
const HIGHLIGHT = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background"];

/**
 * A grip for dragging a meal to another day. It works with a mouse and with a finger, because it is built on
 * pointer events (the browser's own drag and drop does not work on most phones). Each day card carries
 * data-day-drop and data-day-label. Dropping on a day that already has a meal swaps them. The "Move to" menu
 * does the same job from the keyboard.
 */
export function DragHandle({ id, day, name }: { id: string; day: string; name: string }) {
  const toast = useToast();

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const ghost = document.createElement("div");
    ghost.textContent = name;
    ghost.className =
      "pointer-events-none fixed z-50 max-w-56 truncate rounded-md border border-primary bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-lg";
    ghost.style.left = `${e.clientX + 12}px`;
    ghost.style.top = `${e.clientY + 12}px`;
    document.body.appendChild(ghost);

    let over: HTMLElement | null = null;
    const setOver = (el: HTMLElement | null) => {
      if (el === over) return;
      over?.classList.remove(...HIGHLIGHT);
      over = el;
      over?.classList.add(...HIGHLIGHT);
    };

    const onMove = (ev: PointerEvent) => {
      ghost.style.left = `${ev.clientX + 12}px`;
      ghost.style.top = `${ev.clientY + 12}px`;
      setOver(document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-day-drop]") ?? null);
    };

    const cleanup = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey);
      ghost.remove();
      setOver(null);
    };
    const onCancel = () => cleanup();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") cleanup();
    };
    const onUp = async () => {
      const target = over?.dataset.dayDrop;
      const label = over?.dataset.dayLabel ?? "that day";
      cleanup();
      if (!target || target === day) return;
      try {
        const result = await moveMealTo(id, target);
        if (!result.ok) throw new Error("move failed");
        toast.show({
          message: result.swappedWith ? `Swapped ${name} with the meal on ${label}.` : `Moved ${name} to ${label}.`,
          action: {
            label: "Undo",
            onClick: () => {
              void moveMealTo(id, result.fromDay).catch(() =>
                toast.show({ message: "Couldn't undo that. Try again.", tone: "error" })
              );
            },
          },
          duration: 8000,
        });
      } catch {
        toast.show({ message: `Couldn't move ${name}. Try again.`, tone: "error" });
      }
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey);
  }

  return (
    <button
      type="button"
      aria-label={`Drag ${name} to another day`}
      title="Drag to another day"
      onPointerDown={onPointerDown}
      className="hidden size-9 shrink-0 lg:size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing lg:ml-auto lg:flex"
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  );
}
