import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// 16px text on purpose: iPhones zoom the page when you focus a smaller field.
const control =
  "min-h-11 rounded-sm border border-border bg-surface px-3 py-2 text-base text-foreground " +
  "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring " +
  "disabled:cursor-not-allowed disabled:opacity-60";

// Full width unless the caller picks a width (w-20, w-auto, ...). Without this the two would fight.
const width = (className?: string) => (className && /(^|\s)w-/.test(className) ? undefined : "w-full");

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, width(className), className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, width(className), "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, width(className), "min-h-24", className)} {...props} />;
}

/** A label above a control, with an optional hint and error below it. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-sm text-danger-ink">
          {error}
        </span>
      )}
    </label>
  );
}
