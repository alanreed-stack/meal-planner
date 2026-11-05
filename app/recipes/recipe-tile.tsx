import { Beef, Drumstick, Fish, Ham, Utensils } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";

// A soft color and an icon by main meat, so a recipe without a photo still looks like it belongs.
const LOOK: Record<string, { Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; tone: string }> = {
  chicken: { Icon: Drumstick, tone: "bg-warning-soft text-warning-ink" },
  turkey: { Icon: Drumstick, tone: "bg-warning-soft text-warning-ink" },
  beef: { Icon: Beef, tone: "bg-danger-soft text-danger-ink" },
  pork: { Icon: Ham, tone: "bg-diet-family-soft text-diet-family" },
  shrimp: { Icon: Fish, tone: "bg-info-soft text-info-ink" },
  fish: { Icon: Fish, tone: "bg-info-soft text-info-ink" },
  none: { Icon: Utensils, tone: "bg-primary-soft text-primary-ink" },
};

/** The picture area for a recipe that has no photo. */
export function RecipeTile({ protein, className }: { protein: string; className?: string }) {
  const { Icon, tone } = LOOK[protein] ?? LOOK.none;
  return (
    <div aria-hidden className={cn("flex h-36 w-full items-center justify-center", tone, className)}>
      <Icon aria-hidden className="size-14 opacity-60" />
    </div>
  );
}
