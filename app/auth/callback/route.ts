import { NextResponse } from "next/server";
import { trackSignup } from "@/lib/analytics/signup";
import { safeNextPath } from "@/lib/auth/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** OAuth / magic-link (PKCE) landing: exchange the code for a session, then go to `next`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await trackSignup(createAdminClient(), data.user.id);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(
    new URL(
      `/login?error=callback&next=${encodeURIComponent(next)}`,
      url.origin,
    ),
  );
}
