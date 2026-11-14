"use client";

import type { ReactNode } from "react";
import { generateList } from "./actions";
import { useToast } from "@/components/ui/toast";
import { SubmitButton } from "@/components/ui/submit-button";
import { describeBuild } from "@/lib/build-summary";

/** The button that builds or updates the list for a week, and says afterwards what it did. */
export function BuildListForm({
  week,
  variant = "secondary",
  size,
  className,
  children,
}: {
  week: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const toast = useToast();
  return (
    <form
      action={async (fd) => {
        try {
          const result = await generateList(fd);
          toast.show({ message: describeBuild(result), tone: "success" });
        } catch {
          toast.show({ message: "Couldn't update the list. Try again.", tone: "error" });
        }
      }}
    >
      <input type="hidden" name="week" value={week} />
      <SubmitButton variant={variant} size={size} className={className}>
        {children}
      </SubmitButton>
    </form>
  );
}
