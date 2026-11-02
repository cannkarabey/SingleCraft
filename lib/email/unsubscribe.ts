import { createHmac, timingSafeEqual } from "node:crypto";

export type EmailList = "digest" | "alerts";

function secret(): string {
  // A dedicated secret is preferred; the service-role key is server-only and always set.
  const value =
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not set");
  return value;
}

/** One-click unsubscribe token bound to a user and a list (no login needed to use it). */
export function signUnsubscribe(userId: string, list: EmailList): string {
  return createHmac("sha256", secret())
    .update(`unsubscribe:${userId}:${list}`)
    .digest("base64url");
}

export function verifyUnsubscribe(
  userId: string,
  list: EmailList,
  token: string,
): boolean {
  if (!token) return false;
  const expected = Buffer.from(signUnsubscribe(userId, list));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function unsubscribeUrl(
  appUrl: string,
  userId: string,
  list: EmailList,
): string {
  const url = new URL("/api/email/unsubscribe", appUrl);
  url.searchParams.set("u", userId);
  url.searchParams.set("list", list);
  url.searchParams.set("t", signUnsubscribe(userId, list));
  return url.toString();
}

/** RFC 8058 one-click headers (Gmail/Yahoo bulk-sender requirement). */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
