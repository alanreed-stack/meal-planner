"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { RowButton } from "@/components/ui/row-button";
import { cn } from "@/lib/cn";

type Ing = { text: string; familyOnly: boolean };

export function CookMode({
  name,
  backHref,
  ketoNote,
  ingredients,
  steps,
}: {
  name: string;
  backHref: string;
  ketoNote: string;
  ingredients: Ing[];
  steps: string[];
}) {
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const [screen, setScreen] = useState<"checking" | "on" | "off" | "unsupported">("checking");

  // Keep the screen awake while cooking. Browsers drop the lock when the tab is hidden, so ask again.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (!("wakeLock" in navigator)) {
        if (!cancelled) setScreen("unsupported");
        return;
      }
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        setScreen("on");
        lock.addEventListener("release", () => setScreen("off"));
      } catch {
        if (!cancelled) setScreen("off");
      }
    }

    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  const finished = done.filter(Boolean).length;
  const next = done.findIndex((d) => !d);

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl bg-background px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <ButtonLink href={backHref} size="sm">
            <ArrowLeft aria-hidden className="size-4" /> Exit
          </ButtonLink>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{name}</h1>
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {finished} of {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${steps.length ? (finished / steps.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {screen === "on" && "Screen will stay on while you cook."}
          {screen === "off" && "Screen may turn off. Switch back to this tab to try keeping it on."}
          {screen === "unsupported" &&
            "This browser can't keep the screen on. Set your phone's auto-lock to 5 minutes while you cook."}
        </p>
      </header>

      {ketoNote && <Notice tone="success" className="mt-4 text-base">{ketoNote}</Notice>}

      <details className="mt-4 rounded-lg border border-border bg-surface p-3" open>
        <summary className="cursor-pointer text-lg font-semibold">Ingredients</summary>
        <ul className="mt-2 space-y-1.5 text-lg tabular-nums">
          {ingredients.map((i, n) => (
            <li key={n}>
              {i.text}
              {i.familyOnly && (
                <Badge tone="diet-family" className="ml-2">
                  family only
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </details>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={i}>
            <RowButton
              onClick={() => setDone(done.map((d, n) => (n === i ? !d : d)))}
              className={cn(
                "flex w-full gap-3 rounded-lg border-2 p-4 text-left text-xl leading-snug",
                done[i]
                  ? "border-border bg-surface-muted text-muted line-through"
                  : i === next
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface"
              )}
              aria-pressed={done[i]}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-base",
                  done[i] ? "border-primary bg-primary text-primary-foreground" : "border-muted"
                )}
              >
                {done[i] ? <Check aria-hidden className="size-4" /> : i + 1}
              </span>
              <span>{s}</span>
            </RowButton>
          </li>
        ))}
      </ol>

      {steps.length === 0 && <p className="mt-6 text-muted">This recipe has no steps yet.</p>}

      {finished === steps.length && steps.length > 0 && (
        <Card tone="accent" className="mt-6 text-center text-xl font-semibold">
          <PartyPopper aria-hidden className="mx-auto mb-1 size-7 text-primary-ink" />
          All done. Enjoy dinner!
        </Card>
      )}

      {finished > 0 && (
        <Button variant="ghost" className="mt-6" onClick={() => setDone(steps.map(() => false))}>
          Start over
        </Button>
      )}
    </div>
  );
}
