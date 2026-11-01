"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-bold">Family Meal Planner</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {mode === "signin" ? "Sign in to plan the week." : "Create your login."}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border px-3 py-2"
        />
        <button
          disabled={busy}
          className="rounded-lg bg-green-700 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      {msg && <p className="text-sm text-red-700">{msg}</p>}
      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm text-green-800 underline"
      >
        {mode === "signin" ? "New here? Create a login" : "Have a login? Sign in"}
      </button>
    </main>
  );
}
