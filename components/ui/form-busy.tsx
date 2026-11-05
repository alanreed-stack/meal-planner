"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "./spinner";

/**
 * Put this inside a <form>. While the form is submitting it disables everything inside it (so a second tap
 * can't add a duplicate) and shows a small status line.
 */
export function FormBusy({ children, label = "Saving…" }: { children: ReactNode; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className="contents">
      {pending && (
        <p role="status" className="mb-2 flex items-center gap-2 text-sm text-muted">
          <Spinner /> {label}
        </p>
      )}
      {children}
    </fieldset>
  );
}
