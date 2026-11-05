"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/**
 * A button for a server-action form. While the form is submitting it disables itself, and shows a spinner
 * if it is the button that was pressed (so thumbs-up and thumbs-down in one form don't both spin).
 */
export function SubmitButton({ name, value, disabled, ...props }: ButtonProps) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === String(value ?? ""));
  return <Button type="submit" name={name} value={value} pending={mine} disabled={disabled || pending} {...props} />;
}
