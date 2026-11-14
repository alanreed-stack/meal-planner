"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Shown when a page hits a problem, instead of the stock Next.js error. The details stay out of sight. */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg bg-warning-soft text-warning-ink">
        <AlertTriangle aria-hidden className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted">
        That page hit a snag. Nothing you saved was lost. Try again, or head back to the start.
      </p>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="primary" size="lg" onClick={() => retry()}>
          Try again
        </Button>
        <ButtonLink href="/" size="lg">
          Go to Home
        </ButtonLink>
      </div>
      <p className="text-sm text-muted">
        Still stuck? <Link href="/settings" className="text-primary-ink underline">Open Settings</Link> and sign out, then back in.
      </p>
    </main>
  );
}
