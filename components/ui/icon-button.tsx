"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Required. Becomes the accessible name and the hover tooltip. */
  label: string;
  variant?: "ghost" | "secondary" | "danger";
  pending?: boolean;
  /** Smaller on dense desktop rows. Still 44px on phones. */
  compact?: boolean;
  /** For toggles (favorite, thumbs): sets aria-pressed and highlights the button when true. */
  pressed?: boolean;
  pressedTone?: "primary" | "danger";
};

const variants = {
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  danger: "text-danger-ink hover:bg-danger-soft",
};

function Inner({
  label,
  variant = "ghost",
  pending = false,
  compact,
  pressed,
  pressedTone = "primary",
  className,
  children,
  type = "button",
  disabled,
  ...props
}: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-pressed={pressed}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        compact && "md:size-9",
        variants[variant],
        pressed && (pressedTone === "danger" ? "bg-danger-soft text-danger-ink" : "bg-primary-soft text-primary-ink"),
        className
      )}
      {...props}
    >
      {pending ? <Spinner className="size-5" /> : children}
    </button>
  );
}

/** A square icon-only button, 44x44 or more. Pass the icon as children. */
export function IconButton(props: Props) {
  return <Inner {...props} />;
}

/** The same, for a server-action form: shows a spinner while the form submits. */
export function SubmitIconButton({ name, value, ...props }: Props) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === String(value ?? ""));
  return <Inner type="submit" name={name} value={value} pending={mine} disabled={pending} {...props} />;
}
