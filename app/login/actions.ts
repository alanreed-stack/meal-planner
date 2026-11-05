"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { message?: string; info?: boolean; email?: string };

/** Signs in or signs up on the server, so the phone never has to download the Supabase browser library. */
export async function submitLogin(_prev: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  if (!email || !password) return { message: "Enter your email and password.", email };

  const supabase = await createClient();
  if (mode === "signup") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${proto}://${host}/auth/callback` },
    });
    if (error) return { message: error.message, email };
    if (!data.session) return { message: "Check your email for a confirmation link, then sign in.", info: true, email };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { message: error.message, email };
  }
  redirect("/");
}
