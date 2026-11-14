"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Shares the list as plain text: the phone's share sheet when there is one, otherwise it copies it. */
export function ShareList({ title, text }: { title: string; text: string }) {
  const toast = useToast();

  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.show({ message: "List copied. Paste it anywhere.", tone: "success" });
    } catch (e) {
      // Closing the share sheet counts as an AbortError. It is not a problem.
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.show({ message: "Couldn't share the list.", tone: "error" });
    }
  }

  return (
    <Button onClick={share}>
      <Share2 aria-hidden className="size-4" /> Share list
    </Button>
  );
}
