"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function worker(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.ready.then((reg) => reg.active).catch(() => null);
}

/**
 * Sets up the service worker (public/sw.js), which keeps the in-store list working with no signal. Only in the real
 * app, not while developing. On the sign-in page it also throws away what was kept, so a shared phone does not hold
 * the last person's list.
 */
export function ServiceWorker() {
  const path = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (path === "/login") void worker().then((w) => w?.postMessage({ type: "clear" }));
  }, [path]);

  return null;
}

/** Asks the service worker to keep a page (and the files it needs) for offline use. Run it again when `version` changes. */
export function PrecachePage({ href, version }: { href: string; version?: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    // A little delay, so it never competes with the page the person is looking at.
    const id = setTimeout(() => void worker().then((w) => w?.postMessage({ type: "cache-page", url: href })), 1500);
    return () => clearTimeout(id);
  }, [href, version]);
  return null;
}
