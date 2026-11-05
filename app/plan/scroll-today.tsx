"use client";

import { useEffect } from "react";

/** Scrolls the given day's card into view once, when the page first loads. */
export function ScrollToToday({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.scrollIntoView({ block: "center" });
  }, [targetId]);
  return null;
}
