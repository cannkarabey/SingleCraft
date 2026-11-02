import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { FeedbackInput, submitFeedback } from "@/lib/feedback";
import { invalid, jsonBody, unauthorized } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

/** Beta feedback widget (plan §9 Faz 9). */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = FeedbackInput.safeParse(await jsonBody(request));
  if (!body.success) return invalid(body.error.issues);
  const result = await submitFeedback(createAdminClient(), user.id, body.data);
  if (result === "limit")
    return NextResponse.json({ error: "limit" }, { status: 429 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
