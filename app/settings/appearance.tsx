"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { setTheme } from "./actions";

type Choice = "auto" | "light" | "dark";

const OPTIONS: { value: Choice; label: string; Icon: typeof Sun }[] = [
  { value: "auto", label: "Match my phone", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Light, dark, or whatever the phone is set to. It is remembered on this phone or computer (in a cookie, so the page
 * comes up in the right colors straight away), not for everyone in the household.
 */
export function Appearance({ initial }: { initial: Choice }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(initial);

  async function pick(next: Choice) {
    setChoice(next);
    // The colors change at once; the cookie makes it stick, and the refresh moves the browser bar color too.
    const root = document.documentElement;
    if (next === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    await setTheme(next);
    router.refresh();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(value)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              on ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-border bg-surface hover:bg-surface-muted"
            )}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
