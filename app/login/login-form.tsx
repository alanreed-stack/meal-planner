"use client";

import { useActionState, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { requestPasswordReset, submitLogin } from "./actions";
import { Button } from "@/components/ui/button";
import { cardStyles } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export function LoginForm({ linkProblem = false }: { linkProblem?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [signIn, signInAction, signingIn] = useActionState(submitLogin, undefined);
  const [reset, resetAction, resetting] = useActionState(requestPasswordReset, undefined);
  const state = mode === "reset" ? reset : signIn;
  const action = mode === "reset" ? resetAction : signInAction;
  const busy = mode === "reset" ? resetting : signingIn;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <UtensilsCrossed aria-hidden className="size-7" />
        </span>
        <h1 className="text-2xl font-bold">Family Meal Planner</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signin" ? "Sign in to plan the week." : mode === "signup" ? "Create your login." : "Choose a new password."}
        </p>
      </div>
      {linkProblem && mode !== "reset" && (
        <Notice tone="warning">
          That reset link didn&apos;t work. It may have expired, been used already, or been opened on a different phone than
          the one you asked from. Ask for a new one below.
        </Notice>
      )}
      <form action={action} key={mode} className={cardStyles("default", true, "flex flex-col gap-4")}>
        <input type="hidden" name="mode" value={mode} />
        <Field label="Email">
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state?.email}
          />
        </Field>
        {mode !== "reset" && (
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </Field>
        )}
        {state?.message && <Notice tone={state.info ? "info" : "error"}>{state.message}</Notice>}
        <Button type="submit" variant="primary" size="lg" pending={busy}>
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Email me a link"}
        </Button>
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setMode("reset")}
            className="min-h-11 text-sm text-primary-ink underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Forgot your password?
          </button>
        )}
      </form>
      <Button variant="ghost" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "New here? Create a login" : mode === "signup" ? "Have a login? Sign in" : "Back to sign in"}
      </Button>
    </main>
  );
}
