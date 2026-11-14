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
  children,
}: {
  week: string;
  variant?: "primary" | "secondary" | "ghost";
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
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </form>
  );
}
