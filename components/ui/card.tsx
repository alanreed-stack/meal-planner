import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "accent" | "dashed";

const tones: Record<Tone, string> = {
  default: "border-border bg-surface",
  accent: "border-2 border-primary bg-primary-soft",
  dashed: "border-dashed border-border bg-surface",
};

/** Card look for an element that needs its own props, e.g. <form action={...} className={cardStyles()}>. */
export function cardStyles(tone: Tone = "default", padded = true, className?: string) {
  return cn("rounded-lg border", tones[tone], padded && "p-4", className);
}

export function Card({
  as: Tag = "div",
  tone = "default",
  padded = true,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: ElementType; tone?: Tone; padded?: boolean }) {
  return <Tag className={cardStyles(tone, padded, className)} {...props} />;
}

/** The small uppercase heading used above a group of content. */
export function SectionHeader({
  as: Tag = "h2",
  action,
  className,
  children,
}: {
  as?: ElementType;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <Tag className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</Tag>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card tone="dashed" className={cn("p-6 text-center", className)}>
      {icon && <div className="mx-auto mb-2 flex w-fit text-muted">{icon}</div>}
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </Card>
  );
}
