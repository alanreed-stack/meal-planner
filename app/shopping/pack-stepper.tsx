"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { setPacks } from "./kroger-actions";

/**
 * Packages to buy, with minus and plus right on the row. It changes the instant you tap, and saves a moment after
 * the last tap so a few quick taps are one save. The page gives it a new key when the saved value changes.
 */
export function PackStepper({ id, value, name }: { id: string; value: number; name: string }) {
  const [n, setN] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function change(next: number) {
    const clamped = Math.min(50, Math.max(1, next));
    if (clamped === n) return;
    setN(clamped);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await setPacks(id, clamped);
      } catch {
        setN(value);
        toast.show({ message: `Couldn't change the amount for ${name}. Try again.`, tone: "error" });
      }
    }, 500);
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Packages of ${name}`}>
      <IconButton label="Fewer packages" variant="secondary" compact disabled={n <= 1} onClick={() => change(n - 1)}>
        <Minus aria-hidden className="size-4" />
      </IconButton>
      <output className="min-w-8 text-center font-medium text-foreground tabular-nums" aria-live="polite">
        {n}
      </output>
      <IconButton label="More packages" variant="secondary" compact disabled={n >= 50} onClick={() => change(n + 1)}>
        <Plus aria-hidden className="size-4" />
      </IconButton>
    </div>
  );
}
