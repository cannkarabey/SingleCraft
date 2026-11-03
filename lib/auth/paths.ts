/** Where member-only areas live; the proxy redirects visitors and guests to /login. */
const PROTECTED_PREFIXES = ["/radar", "/onboarding", "/settings", "/admin"];
/** Open to everyone: visitors without a session get a guest (anonymous) one. */
const GUEST_PREFIXES = ["/studio"];

const under = (pathname: string, prefixes: string[]) =>
  prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const isProtectedPath = (pathname: string) =>
  under(pathname, PROTECTED_PREFIXES);
export const isGuestPath = (pathname: string) =>
  under(pathname, GUEST_PREFIXES);

const MAX_LENGTH = 512;

/**
 * Post-login redirect target. Only same-origin absolute paths are allowed: no scheme, no
 * protocol-relative `//host`, no backslash tricks, no control characters (open-redirect and
 * header-injection guard).
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/radar",
): string {
  if (!raw || raw.length > MAX_LENGTH) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\"))
    return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  return raw;
}

/**
 * Magic-link / OAuth landing URL on the configured app origin. Never derived from request
 * headers: a spoofed X-Forwarded-Host could send the login code to another host.
 */
export function authCallbackUrl(next: string): string {
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
