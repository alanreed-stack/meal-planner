import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

/** Shown for an address that doesn't exist, or a recipe that was deleted. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg bg-info-soft text-info-ink">
        <Compass aria-hidden className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">We can&apos;t find that page</h1>
      <p className="text-muted">It may have been removed, or the link may be old.</p>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink href="/" variant="primary" size="lg">
          Go to Home
        </ButtonLink>
        <ButtonLink href="/recipes" size="lg">
          See recipes
        </ButtonLink>
      </div>
    </main>
  );
}
