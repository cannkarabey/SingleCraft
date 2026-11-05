import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, notFound, unauthorized } from "@/lib/http";
import { GenerateInput } from "@/lib/studio/controls";
import { requestBrief } from "@/lib/studio/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 202 + briefId; generation runs in Inngest (plan §6.3). 429 at the daily limit. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = GenerateInput.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);

  const db = await createClient();
  const { storyId, ...controls } = parsed.data;
  const result = await requestBrief({
    userDb: db,
    admin: createAdminClient(),
    userId: user.id,
    storyId,
    controls,
    send: (event) => inngest.send(event),
  });

  if (result.status === "not_found") return notFound();
  if (result.status === "limit")
    return NextResponse.json({ error: "limit" }, { status: 429 });
  return NextResponse.json({ briefId: result.briefId }, { status: 202 });
}
