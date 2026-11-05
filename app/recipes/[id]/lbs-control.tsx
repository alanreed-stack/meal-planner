"use client";

import { useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";

const clamp = (n: number) => Math.min(10, Math.max(0.5, n));

/**
 * "Make it with ___ lb of meat", with − and + buttons. Changing it re-scales every amount on the page
 * (the number lives in the address as ?lbs=, so the scaled recipe can be shared or bookmarked).
 */
export function LbsControl({ value, base, factor }: { value: number; base: number; factor: number }) {
  const id = useId();
  const router = useRouter();
  const path = usePathname();
  const [text, setText] = useState(String(value));
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function apply(raw: string) {
    setText(raw);
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    clearTimeout(timer.current);
    // Wait a moment so typing "2.5" doesn't reload at "2".
    timer.current = setTimeout(
      () => startTransition(() => router.replace(`${path}?lbs=${clamp(n)}`, { scroll: false })),
      350
    );
  }
  const step = (d: number) => apply(String(clamp(Math.round(((parseFloat(text) || value) + d) * 4) / 4)));

  const scaled = Math.abs(factor - 1) > 0.01;
  // The label points at the number box by id. (Wrapping the buttons in a <label> would attach it to the first button.)
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        Make it with (pounds of meat)
      </label>
      <div className="flex items-center gap-2" aria-busy={pending || undefined}>
        <IconButton label="Less meat" variant="secondary" onClick={() => step(-0.25)}>
          <Minus aria-hidden className="size-5" />
        </IconButton>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.25"
          min="0.5"
          max="10"
          value={text}
          onChange={(e) => apply(e.target.value)}
          className="w-24 text-center tabular-nums"
        />
        <IconButton label="More meat" variant="secondary" onClick={() => step(0.25)}>
          <Plus aria-hidden className="size-5" />
        </IconButton>
        <span className="text-sm text-muted">lb</span>
      </div>
      <p className="mt-1 text-sm text-muted tabular-nums">
        {scaled
          ? `Scaled from ${Math.round(base * 100) / 100} lb as written (×${Math.round(factor * 100) / 100}).`
          : "Matches the recipe as written."}
      </p>
    </div>
  );
}
