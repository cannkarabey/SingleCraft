import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/** OAuth / magic-link (PKCE) landing: exchange the code for a session, then go to `next`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(
    new URL(
      `/login?error=callback&next=${encodeURIComponent(next)}`,
      url.origin,
    ),
  );
}
