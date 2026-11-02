import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { portalFor } from "@/lib/billing/checkout";
import { billingConfigured } from "@/lib/billing/lemonsqueezy";
import { notFound, unauthorized } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!(await currentUser())) return unauthorized();
  if (!billingConfigured())
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 },
    );
  const url = await portalFor(await createClient());
  return url ? NextResponse.json({ url }) : notFound();
}
