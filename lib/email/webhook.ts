import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { capture } from "@/lib/analytics/server";
import type { Database } from "@/lib/supabase/types";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Resend signs webhooks with Svix: base64 HMAC-SHA256 of `${id}.${timestamp}.${body}` with
 * the base64 key after `whsec_`. The header may list several `v1,<sig>` values (key
 * rotation). Timestamps outside ±5 minutes are rejected to stop replays.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  now: Date = new Date(),
): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  const seconds = Number(timestamp);
  if (
    !Number.isFinite(seconds) ||
    Math.abs(now.getTime() / 1000 - seconds) > TOLERANCE_SECONDS
  )
    return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();
  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type ResendEvent = { type?: string; data?: { email_id?: string } };

/**
 * `email.opened` for a digest we sent → `digest_opened` (plan §10), once per email: the
 * first open stamps `email_log.opened_at`; later opens match no row.
 */
export async function handleResendEvent(
  admin: SupabaseClient<Database>,
  event: ResendEvent,
): Promise<"digest_opened" | "ignored"> {
  const emailId = event.data?.email_id;
  if (event.type !== "email.opened" || !emailId) return "ignored";
  const { data, error } = await admin
    .from("email_log")
    .update({ opened_at: new Date().toISOString() })
    .eq("provider_id", emailId)
    .eq("kind", "digest")
    .is("opened_at", null)
    .select("id, user_id, day")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "ignored";
  await capture({
    event: "digest_opened",
    distinctId: data.user_id,
    properties: { email_log_id: data.id, day: data.day },
  });
  return "digest_opened";
}
