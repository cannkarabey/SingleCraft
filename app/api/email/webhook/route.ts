import { NextResponse } from "next/server";
import { handleResendEvent, verifySvixSignature } from "@/lib/email/webhook";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resend webhook (plan §10: digest opens). Open tracking must be enabled on the Resend
 * domain. The signature covers the raw body, so it is read as text first.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifySvixSignature(raw, request.headers, secret))
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const result = await handleResendEvent(
    createAdminClient(),
    event as Parameters<typeof handleResendEvent>[1],
  );
  return NextResponse.json({ result });
}
