"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

/** True on a phone-sized screen. Menus and pickers become bottom sheets there. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
