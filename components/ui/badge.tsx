import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "diet-both"
  | "diet-keto"
  | "diet-family";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted",
  success: "bg-primary-soft text-primary-ink",
  warning: "bg-warning-soft text-warning-ink",
  info: "bg-info-soft text-info-ink",
  danger: "bg-danger-soft text-danger-ink",
  "diet-both": "bg-diet-both-soft text-diet-both",
  "diet-keto": "bg-diet-keto-soft text-diet-keto",
  "diet-family": "bg-diet-family-soft text-diet-family",
};

/** A small static tag. */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/** The right Badge for a recipe's diet. */
export function DietBadge({ diet }: { diet: string }) {
  if (diet === "keto") return <Badge tone="diet-keto">Keto only</Badge>;
  if (diet === "family") return <Badge tone="diet-family">Family only</Badge>;
  return <Badge tone="diet-both">Keto + family</Badge>;
}
