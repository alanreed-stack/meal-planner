"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Pages that show live data and are worth pulling down to refresh.
const PAGES = ["/", "/plan", "/shopping"];
const THRESHOLD = 70;

/**
 * Pull down from the top of Home, Week or Shopping to reload their data. It only does anything when the app is
 * installed on the home screen (an installed app has no browser bar with a refresh button, and iPhones have no
 * pull to refresh there at all). In a normal browser tab the browser's own gesture is left alone.
 */
export function PullToRefresh() {
  const router = useRouter();
  const path = usePathname();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const distance = useRef(0);
  const armed = PAGES.includes(path);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!armed || !standalone) return;

    const onStart = (e: TouchEvent) => {
      // Not while a sheet is open, or when the finger starts in something that scrolls sideways.
      const t = e.target as HTMLElement | null;
      const blocked = !!document.querySelector("dialog[open]") || !!t?.closest("[data-no-ptr], input, textarea, select");
      start.current = window.scrollY <= 0 && !blocked ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        distance.current = 0;
        setPull(0);
        return;
      }
      distance.current = Math.min(dy * 0.5, 100); // the further you pull, the harder it gets
      setPull(distance.current);
    };
    const onEnd = () => {
      const pulledFar = start.current !== null && distance.current >= THRESHOLD / 2;
      start.current = null;
      distance.current = 0;
      setPull(0);
      if (pulledFar) {
        setBusy(true);
        router.refresh();
        setTimeout(() => setBusy(false), 900);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [armed, router]);

  if (!armed || (pull === 0 && !busy)) return null;
  const ready = pull >= THRESHOLD / 2;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{ transform: `translateY(${busy ? 24 : Math.max(pull - 20, 0)}px)` }}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-primary-ink shadow-md">
        <RefreshCw className={`size-5 ${busy ? "animate-spin" : ""}`} style={busy ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: ready ? 1 : 0.6 }} />
      </span>
      <span className="sr-only" role="status">
        {busy ? "Refreshing" : ""}
      </span>
    </div>
  );
}
