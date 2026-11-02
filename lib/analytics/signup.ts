import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { capture } from "./server";

/**
 * Sends `signed_up` the first time a user completes sign-in (plan §10 funnels). The
 * conditional update makes it once per user even with parallel callbacks.
 */
export async function trackSignup(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .update({ signup_captured_at: new Date().toISOString() })
    .eq("id", userId)
    .is("signup_captured_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return false;
  await capture({ event: "signed_up", distinctId: userId });
  return true;
}
