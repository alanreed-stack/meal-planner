"use client";

import { Shuffle } from "lucide-react";
import { reshuffleDay } from "@/lib/autofill";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { replaceMeal } from "./actions";
import { usePlanInput } from "./plan-context";

/**
 * "Swap for something else": one tap puts a different recipe in this meal, picked with the same rules as
 * "fill the week". It happens at once, and the toast has an Undo.
 */
export function SwapMeal({
  id,
  day,
  recipeId,
  name,
  lbs,
}: {
  id: string;
  day: string;
  recipeId: string;
  name: string;
  /** This meal's own meat weight, put back if you undo. */
  lbs: number | null;
}) {
  const input = usePlanInput();
  const toast = useToast();

  async function swap() {
    if (!input) return;
    const current = input.cands.find((c) => c.id === recipeId) ?? null;
    const next = reshuffleDay(input, current ? { [day]: current } : {}, day);
    if (!next || next.id === recipeId) {
      toast.show({ message: "No other recipe fits that day." });
      return;
    }
    try {
      await replaceMeal(id, next.id, null);
      toast.show({
        message: `Swapped ${name} for ${next.name}.`,
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            void replaceMeal(id, recipeId, lbs).catch(() =>
              toast.show({ message: "Couldn't undo that. Try again.", tone: "error" })
            );
          },
        },
      });
    } catch {
      toast.show({ message: "Couldn't swap that. Try again.", tone: "error" });
    }
  }

  return (
    <Button className="w-full" onClick={swap} data-menu-close>
      <Shuffle aria-hidden className="size-4" /> Swap for something else
    </Button>
  );
}
