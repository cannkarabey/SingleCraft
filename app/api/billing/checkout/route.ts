import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { startCheckout } from "@/lib/billing/checkout";
import { invalid, jsonBody, unauthorized } from "@/lib/http";

const Body = z.object({ plan: z.enum(["creator", "pro"]) });

export async function POST(request: Request) {
  const user = await currentUser();
  // Guests (anonymous sessions) cannot subscribe: no email, throwaway account.
  if (!user || user.anonymous) return unauthorized();
  const body = Body.safeParse(await jsonBody(request));
  if (!body.success) return invalid(body.error.issues);

  const result = await startCheckout({
    userId: user.id,
    email: user.email,
    plan: body.data.plan,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
  if (result.status === "not_configured")
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 },
    );
  if (result.status === "unavailable")
    return NextResponse.json({ error: "plan_unavailable" }, { status: 409 });
  return NextResponse.json({ url: result.url });
}
