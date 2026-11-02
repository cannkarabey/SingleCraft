import { NextResponse } from "next/server";
import { z } from "zod";
import { capture } from "@/lib/analytics/server";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, notFound, unauthorized } from "@/lib/http";
import { PublishInput, publishBrief } from "@/lib/studio/briefs";
import { createClient } from "@/lib/supabase/server";

/** "Yayınladım" with an optional link to the published post (plan §1 #9). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const body = PublishInput.safeParse((await jsonBody(request)) ?? {});
  if (!body.success) return invalid(body.error.issues);
  const db = await createClient();
  const { data: before } = await db
    .from("briefs")
    .select("published_at")
    .eq("id", id.data)
    .maybeSingle();
  if (!before || !(await publishBrief(db, id.data, body.data.url ?? null)))
    return notFound();
  // North-star metric (plan §10): one event per brief, not per link change.
  if (before.published_at === null) {
    await capture({
      event: "brief_published",
      distinctId: user.id,
      properties: { brief_id: id.data, has_url: Boolean(body.data.url) },
    });
  }
  return NextResponse.json({ ok: true });
}
