import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/kroger";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(`${origin}/shopping?${q}`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get("kroger_state")?.value;
  if (!code || !state || !expected || state !== expected) return back("kroger=error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const t = await exchangeCode(code);
    const { error } = await supabase.from("kroger_connections").upsert({
      user_id: user.id,
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) return back("kroger=error");
  } catch {
    return back("kroger=error");
  }
  const res = back("kroger=connected");
  res.cookies.delete("kroger_state");
  return res;
}
