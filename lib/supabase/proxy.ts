import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGuestPath, isProtectedPath } from "@/lib/auth/paths";
import { publicEnv } from "@/lib/env";

// Refreshes the Supabase auth session on every matched request and forwards
// the rotated cookies to both the request (for this render) and the response.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // @supabase/ssr passes no-store cache headers along with refreshed cookies.
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims: it validates and refreshes the token.
  const { data } = await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const isPrefetch =
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch";

  // Studio is open to everyone: no session yet -> a guest session, then back here.
  if (!data?.claims && isGuestPath(pathname) && !isPrefetch) {
    const guest = request.nextUrl.clone();
    guest.pathname = "/auth/guest";
    guest.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(guest);
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }

  // Guests (anonymous sessions) are not members: member-only areas treat them as signed out.
  const signedIn = Boolean(data?.claims) && data?.claims?.is_anonymous !== true;
  if (!signedIn && isProtectedPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(login);
    // Keep any cookies the refresh attempt set (e.g. clearing an expired session).
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
