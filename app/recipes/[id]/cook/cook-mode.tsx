"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    <div className="mx-auto w-full min-h-screen max-w-2xl bg-white px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="rounded border px-3 py-1.5 text-sm">
            Exit
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{name}</h1>
          <span className="shrink-0 text-sm text-neutral-600">
            {finished} of {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-200">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${steps.length ? (finished / steps.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {screen === "on" && "Screen will stay on while you cook."}
          {screen === "off" && "Screen may turn off. Switch back to this tab to try keeping it on."}
          {screen === "unsupported" &&
            "This browser can't keep the screen on. Set your phone's auto-lock to 5 minutes while you cook."}
        </p>
      </header>

      {ketoNote && <p className="mt-4 rounded-lg bg-green-50 p-3 text-base">{ketoNote}</p>}

      <details className="mt-4 rounded-lg border p-3" open>
        <summary className="cursor-pointer text-lg font-semibold">Ingredients</summary>
        <ul className="mt-2 space-y-1.5 text-lg">
          {ingredients.map((i, n) => (
            <li key={n}>
              {i.text}
              {i.familyOnly && <span className="ml-2 rounded bg-amber-100 px-1.5 text-sm">family only</span>}
            </li>
          ))}
        </ul>
      </details>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setDone(done.map((d, n) => (n === i ? !d : d)))}
              className={`flex w-full gap-3 rounded-xl border-2 p-4 text-left text-xl leading-snug ${
                done[i]
                  ? "border-neutral-200 bg-neutral-50 text-neutral-400 line-through"
                  : i === next
                    ? "border-green-600 bg-green-50"
                    : "border-neutral-200 bg-white"
              }`}
              aria-pressed={done[i]}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-base ${
                  done[i] ? "border-green-600 bg-green-600 text-white" : "border-neutral-400"
                }`}
              >
                {done[i] ? "✓" : i + 1}
              </span>
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {steps.length === 0 && <p className="mt-6 text-neutral-500">This recipe has no steps yet.</p>}

      {finished === steps.length && steps.length > 0 && (
        <p className="mt-6 rounded-xl bg-green-50 p-4 text-center text-xl font-semibold">
          All done. Enjoy dinner! 🎉
        </p>
      )}

      {finished > 0 && (
        <button
          type="button"
          onClick={() => setDone(steps.map(() => false))}
          className="mt-6 text-sm text-neutral-500 underline"
        >
          Start over
        </button>
      )}
    </div>
  );
}
