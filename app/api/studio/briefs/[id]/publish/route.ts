import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, notFound, unauthorized } from "@/lib/http";
import { PublishInput, publishBrief } from "@/lib/studio/briefs";
import { createClient } from "@/lib/supabase/server";

/** "Yayınladım" with an optional link to the published post (plan §1 #9). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await currentUser())) return unauthorized();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const body = PublishInput.safeParse((await jsonBody(request)) ?? {});
  if (!body.success) return invalid(body.error.issues);
  if (
    !(await publishBrief(await createClient(), id.data, body.data.url ?? null))
  )
    return notFound();
  return NextResponse.json({ ok: true });
}
