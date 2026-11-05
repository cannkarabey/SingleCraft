import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, notFound, unauthorized } from "@/lib/http";
import { ControlsInput } from "@/lib/studio/controls";
import { requestRegenerate } from "@/lib/studio/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const controls = ControlsInput.safeParse(await jsonBody(request));
  if (!controls.success) return invalid(controls.error.issues);

  const db = await createClient();
  const result = await requestRegenerate({
    userDb: db,
    admin: createAdminClient(),
    userId: user.id,
    briefId: id.data,
    controls: controls.data,
    send: (event) => inngest.send(event),
  });
  if (result.status === "not_found") return notFound();
  if (result.status === "limit")
    return NextResponse.json({ error: "limit" }, { status: 429 });
  return NextResponse.json({ briefId: result.briefId }, { status: 202 });
}
