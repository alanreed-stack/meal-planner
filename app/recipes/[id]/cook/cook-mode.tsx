"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Check, Circle, CheckCircle2, PartyPopper, ThumbsDown, ThumbsUp, Timer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Notice } from "@/components/ui/notice";
import { RowButton } from "@/components/ui/row-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { nowMs } from "@/lib/dates";
import { useWakeLock } from "@/lib/use-wake-lock";
import { readKey, removeOld, serverSnapshot, subscribe, writeKey } from "@/lib/cook-store";
import {
  cookKey,
  findTimers,
  formatClock,
  isOldCookKey,
  readCook,
  type SavedCook,
} from "@/lib/cook";
import { rateMeal } from "@/app/plan/actions";
import { rateRecipe } from "@/app/recipes/actions";

type Ing = { text: string; familyOnly: boolean };
type Size = "normal" | "large";

const SIZE_KEY = "cook:size";

export function CookMode({
  recipeId,
  mealId,
  today,
  name,
  backHref,
  ketoNote,
  notes,
  ingredients,
  steps,
}: {
  recipeId: string;
  /** Tonight's planned meal for this recipe, so the rating lands on it. */
  mealId: string | null;
  /** Today's date (Eastern). Saved progress is kept for the day and cleared the next. */
  today: string;
  name: string;
  backHref: string;
  ketoNote: string;
  /** Family notes on the recipe. */
  notes: string;
  ingredients: Ing[];
  steps: string[];
}) {
  const toast = useToast();
  const key = cookKey(recipeId, today);

  // Saved progress lives in the browser (see lib/cook-store.ts). Before it loads, everything is unchecked.
  const raw = useSyncExternalStore(subscribe, () => readKey(key), serverSnapshot);
  const saved = useMemo(() => readCook(raw, steps.length, ingredients.length), [raw, steps.length, ingredients.length]);
  const { done, gathered, timers, rated } = saved;
  const save = (patch: Partial<SavedCook>) => writeKey(key, JSON.stringify({ ...saved, ...patch }));
  const setDone = (v: boolean[]) => save({ done: v });
  const setGathered = (v: boolean[]) => save({ gathered: v });

  const sizeRaw = useSyncExternalStore(subscribe, () => readKey(SIZE_KEY), serverSnapshot);
  const size: Size = sizeRaw === "large" ? "large" : "normal";
  const changeSize = (s: Size) => writeKey(SIZE_KEY, s);

  const [now, setNow] = useState(0);
  const screen = useWakeLock();

  const audio = useRef<AudioContext | null>(null);
  const rung = useRef<Set<string>>(new Set());
  const stepEls = useRef<(HTMLLIElement | null)[]>([]);

  // Browsers only allow sound after a tap. Timers that were running before a reload need the sound set up again,
  // so the first tap anywhere on the page does it.
  useEffect(() => {
    const arm = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        // no sound, the phone will still vibrate
      }
    };
    document.addEventListener("pointerdown", arm, { once: true });
    document.addEventListener("keydown", arm, { once: true });
    return () => {
      document.removeEventListener("pointerdown", arm);
      document.removeEventListener("keydown", arm);
    };
  }, []);

  // Progress from other days is thrown away.
  useEffect(() => removeOld((k) => isOldCookKey(k, today)), [today]);

  // ---- timers: a clock that ticks while any exist, and rings once when one runs out
  const ring = useCallback(() => {
    try {
      navigator.vibrate?.([400, 150, 400, 150, 800]);
    } catch {
      // vibration is not available everywhere
    }
    const ctx = audio.current;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [0, 0.45, 0.9].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.4);
    });
  }, []);

  useEffect(() => {
    if (timers.length === 0) return;
    const tick = () => setNow(nowMs());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timers.length]);

  useEffect(() => {
    for (const t of timers) {
      if (now === 0 || t.endsAt > now || rung.current.has(t.id)) continue;
      rung.current.add(t.id);
      // Ring if it ran out just now (or while the phone was locked). One from long ago just shows as finished.
      if (now - t.endsAt < 10 * 60 * 1000) ring();
    }
  }, [now, timers, ring]);

  function startTimer(step: number, seconds: number, label: string) {
    // The browser only allows sound after a tap, so the sound system is set up here, on the tap.
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {
      // no sound, the phone will still vibrate
    }
    const t = nowMs();
    setNow(t);
    save({ timers: [...timers, { id: `${t}-${step}-${seconds}`, step, label, endsAt: t + seconds * 1000 }] });
  }

  const stopTimer = (id: string) => save({ timers: timers.filter((t) => t.id !== id) });

  // ---- steps
  const finished = done.filter(Boolean).length;
  const next = done.findIndex((d) => !d);
  const allDone = steps.length > 0 && finished === steps.length;
  const gatheredCount = gathered.filter(Boolean).length;

  const scrollToStep = (i: number) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stepEls.current[i]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  function advance() {
    if (next < 0) return;
    const following = done.findIndex((d, n) => !d && n !== next);
    setDone(done.map((d, n) => (n === next ? true : d)));
    if (following >= 0) requestAnimationFrame(() => scrollToStep(following));
  }

  async function rate(rating: 1 | -1 | 0) {
    save({ rated: true });
    if (rating === 0) return;
    const fd = new FormData();
    fd.set("id", mealId ?? recipeId);
    fd.set("rating", String(rating));
    try {
      await (mealId ? rateMeal(fd) : rateRecipe(fd));
      toast.show({ message: rating === 1 ? "Glad you liked it. Saved." : "Noted. We'll suggest it less.", tone: "success" });
    } catch {
      save({ rated: false });
      toast.show({ message: "Couldn't save that rating. Try again.", tone: "error" });
    }
  }

  const large = size === "large";
  const running = timers.filter((t) => t.endsAt > now);
  const finishedTimers = timers.filter((t) => t.endsAt <= now && now > 0);

  return (
    <main id="main" className="mx-auto min-h-screen w-full max-w-2xl bg-background px-4 pb-32">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <ButtonLink href={backHref} size="sm">
            <ArrowLeft aria-hidden className="size-4" /> Exit
          </ButtonLink>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{name}</h1>
          <IconButton
            label={large ? "Use normal text size" : "Use large text"}
            variant="secondary"
            compact
            pressed={large}
            onClick={() => changeSize(large ? "normal" : "large")}
          >
            <span aria-hidden className="text-base leading-none font-semibold">
              Aa
            </span>
          </IconButton>
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

        {timers.length > 0 && (
          <ul aria-label="Timers" className="mt-2 max-h-[35vh] space-y-1.5 overflow-y-auto">
            {finishedTimers.map((t) => (
              <li
                key={t.id}
                role="alert"
                className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-1.5 text-warning-ink"
              >
                <Timer aria-hidden className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 font-semibold">
                  Time&apos;s up: step {t.step + 1}, {t.label}
                </span>
                <Button size="sm" variant="secondary" onClick={() => stopTimer(t.id)}>
                  Dismiss
                </Button>
              </li>
            ))}
            {running.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-md bg-info-soft px-3 py-1 text-info-ink">
                <Timer aria-hidden className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 text-sm">
                  Step {t.step + 1} · {t.label}
                </span>
                <span className="text-lg font-bold tabular-nums" role="timer" aria-label={`${formatClock((t.endsAt - now) / 1000)} left`}>
                  {formatClock((t.endsAt - now) / 1000)}
                </span>
                <IconButton label={`Cancel the step ${t.step + 1} timer`} compact onClick={() => stopTimer(t.id)}>
                  <X aria-hidden className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </header>

      {ketoNote && (
        <Notice tone="success" className={cn("mt-4", large ? "text-xl" : "text-base")}>
          {ketoNote}
        </Notice>
      )}

      {notes && (
        <Notice tone="info" className={cn("mt-3", large ? "text-xl" : "text-base")}>
          <b>Family notes:</b> {notes}
        </Notice>
      )}

      <details className="mt-4 rounded-lg border border-border bg-surface p-3" open>
        <summary className="cursor-pointer text-lg font-semibold">
          Ingredients
          <span className="ml-2 text-sm font-normal text-muted tabular-nums">
            {gatheredCount} of {ingredients.length} gathered
          </span>
        </summary>
        <ul className="mt-2">
          {ingredients.map((ing, n) => (
            <li key={n}>
              <RowButton
                onClick={() => setGathered(gathered.map((g, i) => (i === n ? !g : g)))}
                aria-pressed={gathered[n]}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-md px-1 py-1.5 text-left tabular-nums",
                  large ? "text-2xl" : "text-lg",
                  gathered[n] && "text-muted line-through"
                )}
              >
                {gathered[n] ? (
                  <CheckCircle2 aria-hidden className="size-6 shrink-0 text-primary" />
                ) : (
                  <Circle aria-hidden className="size-6 shrink-0 text-muted" />
                )}
                <span>
                  {ing.text}
                  {ing.familyOnly && (
                    <Badge tone="diet-family" className="ml-2 align-middle">
                      family only
                    </Badge>
                  )}
                </span>
              </RowButton>
            </li>
          ))}
        </ul>
      </details>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const found = findTimers(s);
          return (
            <li
              key={i}
              ref={(el) => {
                stepEls.current[i] = el;
              }}
              className="scroll-mt-40"
            >
              <RowButton
                onClick={() => setDone(done.map((d, n) => (n === i ? !d : d)))}
                className={cn(
                  "flex w-full gap-3 rounded-lg border-2 p-4 text-left leading-snug",
                  large ? "text-3xl" : "text-xl",
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
              {found.length > 0 && !done[i] && (
                <div className="mt-2 flex flex-wrap gap-2 pl-1">
                  {found.map((f) => {
                    const on = running.some((t) => t.step === i && t.label === f.label);
                    return (
                      <Button
                        key={f.seconds}
                        variant="secondary"
                        size="lg"
                        disabled={on}
                        onClick={() => startTimer(i, f.seconds, f.label)}
                      >
                        <Timer aria-hidden className="size-5" /> {on ? `${f.label} timer running` : `Start ${f.label} timer`}
                      </Button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {steps.length === 0 && <p className="mt-6 text-muted">This recipe has no steps yet.</p>}

      {allDone && (
        <Card tone="accent" className="mt-6 space-y-3 text-center">
          <PartyPopper aria-hidden className="mx-auto size-7 text-primary-ink" />
          <p className="text-xl font-semibold">All done. Enjoy dinner!</p>
          {rated ? (
            <p className="text-muted">Thanks for the rating.</p>
          ) : (
            <>
              <p className="text-lg">How was it?</p>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" size="lg" onClick={() => rate(1)}>
                  <ThumbsUp aria-hidden className="size-5" /> Loved it
                </Button>
                <Button variant="secondary" size="lg" onClick={() => rate(-1)}>
                  <ThumbsDown aria-hidden className="size-5" /> Not a fan
                </Button>
              </div>
              <Button variant="ghost" onClick={() => rate(0)}>
                Skip
              </Button>
            </>
          )}
        </Card>
      )}

      {(finished > 0 || gatheredCount > 0) && (
        <Button
          variant="ghost"
          className="mt-6"
          onClick={() => save({ done: steps.map(() => false), gathered: ingredients.map(() => false), rated: false })}
        >
          Start over
        </Button>
      )}

      {/* Big and at the bottom, so a knuckle can hit it with messy hands. */}
      {steps.length > 0 && !allDone && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Button variant="primary" size="lg" className="h-14 w-full text-lg" onClick={advance}>
              <Check aria-hidden className="size-5" />
              {next === steps.length - 1 ? `Step ${next + 1} done. Finish` : `Step ${next + 1} done. Next`}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
