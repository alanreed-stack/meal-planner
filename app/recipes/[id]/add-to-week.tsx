"use client";

import { useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { addMeal } from "@/app/plan/actions";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";

/** "Add to this week": a small sheet with a day and a meal, then straight to the plan. */
export function AddToWeek({
  recipeId,
  recipeName,
  days,
  today,
}: {
  recipeId: string;
  recipeName: string;
  days: { value: string; label: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="flex-1" onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden className="size-4" /> Add to this week
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Add ${recipeName} to the plan`}>
        <form action={addMeal}>
          <input type="hidden" name="go" value="1" />
          <input type="hidden" name="recipe_id" value={recipeId} />
          <div className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-4">
            <h2 className="flex-1 truncate font-semibold">Add to the plan</h2>
            <IconButton label="Close" onClick={() => setOpen(false)}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>
          <div className="space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="text-sm text-muted">{recipeName}</p>
            <Field label="Day" hint="This week and next week.">
              <Select name="day" defaultValue={days.some((d) => d.value === today) ? today : days[0]?.value}>
                {days.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Meal">
              <Select name="slot" defaultValue="dinner">
                <option value="dinner">Dinner</option>
                <option value="lunch">Lunch</option>
                <option value="breakfast">Breakfast</option>
              </Select>
            </Field>
            <SubmitButton variant="primary" size="lg" className="w-full">
              Add to plan
            </SubmitButton>
          </div>
        </form>
      </Sheet>
    </>
  );
}
