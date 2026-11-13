"use client";

import { copyLastWeek } from "./actions";
import { useToast } from "@/components/ui/toast";
import { SubmitButton } from "@/components/ui/submit-button";

/** "Copy last week": fills only the empty slots, then says what it did. */
export function CopyLastWeek({ week, variant = "ghost" }: { week: string; variant?: "ghost" | "secondary" }) {
  const toast = useToast();
  return (
    <form
      action={async (fd) => {
        try {
          const { copied, lastWeekEmpty } = await copyLastWeek(fd);
          if (lastWeekEmpty) toast.show({ message: "Last week was empty." });
          else if (copied === 0) toast.show({ message: "Nothing to copy. Those days are already planned." });
          else toast.show({ message: `Copied ${copied} meal${copied === 1 ? "" : "s"}.`, tone: "success" });
        } catch {
          toast.show({ message: "Couldn't copy last week. Try again.", tone: "error" });
        }
      }}
    >
      <input type="hidden" name="week" value={week} />
      <SubmitButton variant={variant}>Copy last week</SubmitButton>
    </form>
  );
}
