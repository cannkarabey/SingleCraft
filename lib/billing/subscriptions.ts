import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SubscriptionEvent } from "./lemonsqueezy";

type Db = SupabaseClient<Database>;

/** Applies a verified subscription event; returns the user's plan, or null for unknown users. */
export async function applySubscriptionEvent(
  admin: Db,
  event: SubscriptionEvent,
  now: Date,
) {
  const { data, error } = await admin.rpc("apply_subscription", {
    p_user: event.userId,
    p_subscription_id: event.subscriptionId,
    p_customer_id: event.customerId,
    p_variant_id: event.variantId,
    p_plan: event.plan,
    p_status: event.status,
    p_ends_at: event.endsAt as string,
    p_renews_at: event.renewsAt as string,
    p_updated_at: event.updatedAt,
    p_now: now.toISOString(),
  });
  if (error) {
    // 23503: the user no longer exists (deleted account) — nothing to apply.
    if (error.code === "23503") return null;
    throw new Error(error.message);
  }
  return data;
}
