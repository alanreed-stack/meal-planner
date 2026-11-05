import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl } from "@/lib/kroger";

export async function GET(request: Request) {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  // Remember which week's list you were on, so you land back there after signing in.
  const w = new URL(request.url).searchParams.get("w") ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
    res.cookies.set("kroger_week", w, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  }
  res.cookies.set("kroger_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
