import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

export const WEBHOOK_SECRET = "whsec_test";

export function configureBilling() {
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID = "5001";
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "5002";
}

/** A Lemon Squeezy subscription webhook for `userId`, as Lemon Squeezy would sign it. */
export function subscriptionWebhook(
  userId: string,
  overrides: {
    event?: string;
    status?: string;
    endsAt?: string | null;
    updatedAt: string;
    subscriptionId?: string;
  },
  secret = WEBHOOK_SECRET,
) {
  const payload = JSON.parse(
    readFileSync(
      "tests/fixtures/lemonsqueezy/subscription_created.json",
      "utf8",
    ),
  );
  payload.meta.event_name = overrides.event ?? "subscription_updated";
  payload.meta.custom_data.user_id = userId;
  payload.data.id = overrides.subscriptionId ?? `sub-${userId.slice(0, 8)}`;
  payload.data.attributes.status = overrides.status ?? "active";
  payload.data.attributes.ends_at = overrides.endsAt ?? null;
  payload.data.attributes.updated_at = overrides.updatedAt;
  const body = JSON.stringify(payload);
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-event-name": payload.meta.event_name,
      "x-signature": createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  });
}
