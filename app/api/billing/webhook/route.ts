import { NextResponse } from "next/server";
import {
  parseSubscriptionEvent,
  verifyWebhookSignature,
} from "@/lib/billing/lemonsqueezy";
import { applySubscriptionEvent } from "@/lib/billing/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lemon Squeezy webhook (plan §7). The signature covers the raw body, so the body is read
 * as text before parsing. Non-subscription events are acknowledged and ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 },
    );

  const raw = await request.text();
  if (
    !verifyWebhookSignature(raw, request.headers.get("x-signature"), secret)
  ) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = parseSubscriptionEvent(
    payload as Parameters<typeof parseSubscriptionEvent>[0],
  );
  if (!event) return NextResponse.json({ ignored: true });

  const plan = await applySubscriptionEvent(
    createAdminClient(),
    event,
    new Date(),
  );
  return NextResponse.json({ plan });
}
