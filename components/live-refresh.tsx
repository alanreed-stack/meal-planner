"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { watch, type LiveSource } from "@/lib/live";

/**
 * Put this on a page to keep it current. When someone else changes the rows it shows, the page reloads its data
 * (a few changes in a row become one reload). It also reloads when you come back to the tab, which catches anything
 * missed while the phone was asleep. It shows nothing.
 */
export function LiveRefresh({ sources, knownIds = [] }: { sources: LiveSource[]; knownIds?: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The list of sources is rebuilt on every render, so compare it by what it says.
  const key = JSON.stringify(sources);
  const known = JSON.stringify(knownIds);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const ids = new Set(JSON.parse(known) as string[]);
    const stop = watch(JSON.parse(key) as LiveSource[], (c) => {
      // A deleted row only tells us its id, and it could belong to anyone, so only react to ones on this page.
      if (c.event === "DELETE" && !ids.has(String(c.old.id ?? ""))) return;
      refresh();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, known, router]);

  return null;
}
