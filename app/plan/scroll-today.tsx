"use client";

import { useEffect } from "react";

/** Scrolls today's card into view once, when the page first loads. */
export function ScrollToToday() {
  useEffect(() => {
    document.getElementById("today")?.scrollIntoView({ block: "center" });
  }, []);
  return null;
}
