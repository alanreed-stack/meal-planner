import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-info/40 bg-info-soft text-info-ink", Icon: Info },
  success: { box: "border-primary/40 bg-primary-soft text-primary-ink", Icon: CheckCircle2 },
  warning: { box: "border-warning/40 bg-warning-soft text-warning-ink", Icon: AlertTriangle },
  error: { box: "border-danger/40 bg-danger-soft text-danger-ink", Icon: XCircle },
};

/** A banner for something the person should read. Errors and warnings are announced to screen readers. */
export function Notice({
  tone = "info",
  children,
  action,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm", box, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
