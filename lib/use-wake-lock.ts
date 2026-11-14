"use client";

import { useEffect, useState } from "react";

export type ScreenState = "checking" | "on" | "off" | "unsupported";

/**
 * Keeps the phone's screen awake while the page is open. Browsers drop the lock when the tab is hidden, so it asks
 * again when you come back. Reports whether it worked, so the page can say so. Used by cook mode and the in-store list.
 */
export function useWakeLock(): ScreenState {
  const [screen, setScreen] = useState<ScreenState>("checking");

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

  return screen;
}
