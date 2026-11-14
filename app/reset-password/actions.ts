"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { message?: string };

/** Sets a new password for whoever is signed in (including someone who just followed a reset link). */
export async function updatePassword(_prev: PasswordState | undefined, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const again = String(formData.get("again") ?? "");
  if (password.length < 8) return { message: "Use at least 8 characters." };
  if (password !== again) return { message: "The two passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: error.message };
  redirect("/?password=changed");
}
