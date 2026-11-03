import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts a guest session (Supabase anonymous sign-in) so Studio works without an account;
 * the free plan's limits apply to it like to any member. Then goes on to `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"), "/studio");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error)
      return NextResponse.redirect(
        new URL(
          `/login?error=generic&next=${encodeURIComponent(next)}`,
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
