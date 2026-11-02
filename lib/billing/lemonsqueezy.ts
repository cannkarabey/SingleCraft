import { createHmac, timingSafeEqual } from "node:crypto";
import type { Plan } from "./limits";

// Lemon Squeezy (Merchant of Record) REST API, JSON:API format (plan §1 #1).
const API = "https://api.lemonsqueezy.com/v1";
const TIMEOUT_MS = 15_000;

type PaidPlan = Exclude<Plan, "free">;

export function billingConfigured(): boolean {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
    process.env.LEMONSQUEEZY_STORE_ID &&
    process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID,
  );
}

/** Which of our plans a Lemon Squeezy variant sells (configured per environment). */
export function planForVariant(variantId: string | number): PaidPlan | null {
  const id = String(variantId);
  if (id && id === process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID)
    return "creator";
  if (id && id === process.env.LEMONSQUEEZY_PRO_VARIANT_ID) return "pro";
  return null;
}

export function variantForPlan(plan: PaidPlan): string | undefined {
  return plan === "creator"
    ? process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID
    : process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
}

/** X-Signature = hex HMAC-SHA256 of the raw request body with the webhook signing secret. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !/^[0-9a-f]+$/i.test(signature)) return false;
  const expected = Buffer.from(
    createHmac("sha256", secret).update(rawBody).digest("hex"),
    "hex",
  );
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type SubscriptionEvent = {
  event: string;
  userId: string;
  subscriptionId: string;
  customerId: string;
  variantId: string;
  plan: PaidPlan;
  status: string;
  endsAt: string | null;
  renewsAt: string | null;
  updatedAt: string;
};

type Payload = {
  meta?: { event_name?: string; custom_data?: { user_id?: string } };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      customer_id?: number | string;
      variant_id?: number | string;
      status?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      updated_at?: string;
    };
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Subscription webhook → our shape; null for other events, unknown variants or foreign checkouts. */
export function parseSubscriptionEvent(
  payload: Payload,
): SubscriptionEvent | null {
  const event = payload.meta?.event_name ?? "";
  const userId = payload.meta?.custom_data?.user_id ?? "";
  const data = payload.data;
  const a = data?.attributes;
  if (
    !event.startsWith("subscription_") ||
    data?.type !== "subscriptions" ||
    !data.id ||
    !a
  )
    return null;
  if (!UUID.test(userId) || !a.status || !a.updated_at || a.variant_id == null)
    return null;
  const plan = planForVariant(a.variant_id);
  if (!plan) return null;
  return {
    event,
    userId,
    subscriptionId: String(data.id),
    customerId: String(a.customer_id ?? ""),
    variantId: String(a.variant_id),
    plan,
    status: a.status,
    endsAt: a.ends_at ?? null,
    renewsAt: a.renews_at ?? null,
    updatedAt: a.updated_at,
  };
}

async function api<T>(
  fetchImpl: typeof fetch,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY is not set");
  const res = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      accept: "application/vnd.api+json",
      "content-type": "application/vnd.api+json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(
      `Lemon Squeezy ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  return (await res.json()) as T;
}

/** Hosted checkout for one variant; our user id rides along as custom data for the webhook. */
export async function createCheckout(
  input: {
    variantId: string;
    email: string | null;
    userId: string;
    redirectUrl: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          ...(input.email ? { email: input.email } : {}),
          custom: { user_id: input.userId },
        },
        product_options: { redirect_url: input.redirectUrl },
      },
      relationships: {
        store: {
          data: {
            type: "stores",
            id: String(process.env.LEMONSQUEEZY_STORE_ID),
          },
        },
        variant: { data: { type: "variants", id: input.variantId } },
      },
    },
  };
  const res = await api<{ data: { attributes: { url: string } } }>(
    fetchImpl,
    "/checkouts",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data.attributes.url;
}

/** Signed, short-lived customer portal URL (manage payment, cancel, invoices). */
export async function customerPortalUrl(
  subscriptionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await api<{
    data: { attributes: { urls: { customer_portal: string } } };
  }>(fetchImpl, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return res.data.attributes.urls.customer_portal;
}
