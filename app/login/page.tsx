"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardStyles } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setMsg(error.message);
      else if (!data.session)
        setMsg("Check your email for a confirmation link, then sign in.");
      else router.replace("/");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else router.replace("/");
    }
    setBusy(false);
  }

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
      <form onSubmit={submit} className={cardStyles("default", true, "flex flex-col gap-4")}>
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {msg && <Notice tone={msg.startsWith("Check your email") ? "info" : "error"}>{msg}</Notice>}
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
