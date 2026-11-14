"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

/** Shows a one-time message after a redirect (like "Password changed"), then cleans the address so a refresh won't repeat it. */
export function FlashToast({ message, param }: { message: string; param: string }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.show({ message, tone: "success" });
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [message, param, toast]);
  return null;
}
