import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  billingConfigured,
  createCheckout,
  customerPortalUrl,
  variantForPlan,
} from "./lemonsqueezy";

type Db = SupabaseClient<Database>;

/** Hosted checkout for an upgrade; the webhook (not this redirect) changes the plan. */
export async function startCheckout(
  input: {
    userId: string;
    email: string | null;
    plan: "creator" | "pro";
    appUrl: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { status: "ok"; url: string }
  | { status: "not_configured" }
  | { status: "unavailable" }
> {
  if (!billingConfigured()) return { status: "not_configured" };
  const variantId = variantForPlan(input.plan);
  if (!variantId) return { status: "unavailable" };
  const url = await createCheckout(
    {
      variantId,
      email: input.email,
      userId: input.userId,
      redirectUrl: `${input.appUrl.replace(/\/+$/, "")}/settings?billing=success`,
    },
    fetchImpl,
  );
  return { status: "ok", url };
}

/** Customer portal for the caller's most recent subscription (RLS: own rows), or null. */
export async function portalFor(
  userDb: Db,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const { data, error } = await userDb
    .from("subscriptions")
    .select("provider_subscription_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.provider_subscription_id) return null;
  return customerPortalUrl(data.provider_subscription_id, fetchImpl);
}
