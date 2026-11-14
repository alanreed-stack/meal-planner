import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A reset link that is old, already used, or opened on a different phone than the one that asked for it.
    if (error && next === "/reset-password") return NextResponse.redirect(`${origin}/login?reset=failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
