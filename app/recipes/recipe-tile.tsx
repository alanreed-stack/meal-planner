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
export function RecipeTile({
  protein,
  className,
  compact = false,
  size = "sm",
}: {
  protein: string;
  className?: string;
  /** A small square for list rows. */
  compact?: boolean;
  /** For the compact square: 40px or 56px. */
  size?: "sm" | "md";
}) {
  const { Icon, tone } = LOOK[protein] ?? LOOK.none;
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center", compact ? (size === "md" ? "size-14 shrink-0 rounded-md" : "size-10 shrink-0 rounded-md") : "h-36 w-full", tone, className)}
    >
      <Icon aria-hidden className={cn("opacity-60", compact ? (size === "md" ? "size-7" : "size-5") : "size-14")} />
    </div>
  );
}
