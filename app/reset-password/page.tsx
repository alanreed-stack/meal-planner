"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { updatePassword } from "./actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { cardStyles } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export default function ResetPasswordPage() {
  const [state, action, busy] = useActionState(updatePassword, undefined);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <KeyRound aria-hidden className="size-7" />
        </span>
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">Use at least 8 characters.</p>
      </div>
      <form action={action} className={cardStyles("default", true, "flex flex-col gap-4")}>
        <Field label="New password">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Type it again">
          <Input name="again" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        {state?.message && <Notice tone="error">{state.message}</Notice>}
        <Button type="submit" variant="primary" size="lg" pending={busy}>
          Save new password
        </Button>
      </form>
      <ButtonLink href="/" variant="ghost">
        Cancel
      </ButtonLink>
    </main>
  );
}
