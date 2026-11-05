"use client";

import { useActionState, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { submitLogin } from "./actions";
import { Button } from "@/components/ui/button";
import { cardStyles } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, busy] = useActionState(submitLogin, undefined);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <UtensilsCrossed aria-hidden className="size-7" />
        </span>
        <h1 className="text-2xl font-bold">Family Meal Planner</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signin" ? "Sign in to plan the week." : "Create your login."}
        </p>
      </div>
      <form action={action} className={cardStyles("default", true, "flex flex-col gap-4")}>
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
        <Field label="Password" hint="At least 8 characters.">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </Field>
        {state?.message && <Notice tone={state.info ? "info" : "error"}>{state.message}</Notice>}
        <Button type="submit" variant="primary" size="lg" pending={busy}>
          {mode === "signin" ? "Sign in" : "Sign up"}
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "New here? Create a login" : "Have a login? Sign in"}
      </Button>
    </main>
  );
}
