"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <Button onClick={copy}>
      {state === "copied" ? (
        <>
          <Check aria-hidden className="size-4" /> Copied
        </>
      ) : state === "failed" ? (
        "Copy it by hand"
      ) : (
        <>
          <Copy aria-hidden className="size-4" /> {label}
        </>
      )}
    </Button>
  );
}
