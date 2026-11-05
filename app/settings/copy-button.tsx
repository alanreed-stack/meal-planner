"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed"); // clipboard needs a secure page and permission; the code stays visible to copy by hand
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" onClick={copy} className="rounded border px-3 py-1.5 text-sm">
      {state === "copied" ? "Copied ✓" : state === "failed" ? "Copy it by hand" : label}
    </button>
  );
}
