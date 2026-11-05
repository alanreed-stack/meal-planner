"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { ButtonAnchor } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { toggleItem } from "./actions";

/** The order / don't-order checkbox and the item's name. It flips the instant you tap it. */
export function OrderToggle({ id, checked, text }: { id: string; checked: boolean; text: string }) {
  const [on, setOn] = useOptimistic<boolean>(checked);
  const toast = useToast();
  return (
    <>
      <form
        action={async () => {
          setOn(!on);
          const fd = new FormData();
          fd.set("id", id);
          fd.set("to_order", String(on));
          try {
            await toggleItem(fd);
          } catch {
            toast.show({ message: "Couldn't save that. Try again.", tone: "error" });
          }
        }}
      >
        <IconButton type="submit" label={on ? "Don't order" : "Order"} variant="secondary" pressed={on}>
          {on ? <Check aria-hidden className="size-5" /> : null}
        </IconButton>
      </form>
      <span className={cn("ml-2 tabular-nums", !on && "text-muted line-through")}>{text}</span>
    </>
  );
}

const NOTICES: Record<string, { tone: "warning" | "error"; text: string }> = {
  error: { tone: "error", text: "Couldn't connect to Kroger. Please try again." },
  notconnected: { tone: "warning", text: "Connect your Kroger account first." },
  expired: { tone: "warning", text: "Your Kroger connection expired, so nothing was sent. Nothing is lost." },
  nothing: { tone: "warning", text: "Nothing new to send. Match some items first." },
  cartfail: {
    tone: "error",
    text: "Kroger didn't accept the cart, and nothing was marked as sent. Your login is fine. Try again in a minute, and check any rows marked “low confidence” or “check quantity”.",
  },
};

/**
 * Shows what happened after a trip to Kroger (the ?kroger=... in the address). Good news is a toast.
 * Things you need to act on stay as a banner. Either way the address is cleaned up so a refresh doesn't repeat it.
 */
export function KrogerFlash({ status, n, week }: { status?: string; n?: string; week: string }) {
  const toast = useToast();
  const shown = useRef(false);
  const [notice, setNotice] = useState<string | null>(() => (status && NOTICES[status] ? status : null));

  useEffect(() => {
    if (!status || shown.current) return;
    shown.current = true;
    if (status === "connected") toast.show({ message: "Connected to your Kroger account.", tone: "success" });
    if (status === "sent") {
      const count = Number(n) || 0;
      toast.show({
        message: `Sent ${count} item${count === 1 ? "" : "s"} to your Kroger cart.`,
        tone: "success",
        duration: 8000,
        action: { label: "Open cart", href: "https://www.kroger.com/cart" },
      });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("kroger");
    url.searchParams.delete("n");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : `?w=${week}`));
  }, [status, n, week, toast]);

  if (!notice) return null;
  const { tone, text } = NOTICES[notice];
  return (
    <Notice
      tone={tone}
      action={
        <span className="-my-1 -mr-1 flex items-center gap-1">
          {(notice === "expired" || notice === "notconnected") && (
            <ButtonAnchor href={`/api/kroger/connect?w=${week}`} size="sm">
              {notice === "expired" ? "Reconnect Kroger" : "Connect Kroger"}
            </ButtonAnchor>
          )}
          <IconButton label="Dismiss" compact onClick={() => setNotice(null)}>
            <X aria-hidden className="size-4" />
          </IconButton>
        </span>
      }
    >
      {text}
    </Notice>
  );
}
