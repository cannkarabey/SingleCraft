import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyUnsubscribe, type EmailList } from "@/lib/email/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

const Query = z.object({
  u: z.uuid(),
  list: z.enum(["digest", "alerts"]),
  t: z.string().min(1).max(200),
});

async function unsubscribe(
  request: Request,
): Promise<{ ok: true; list: EmailList } | { ok: false }> {
  const query = Query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (
    !query.success ||
    !verifyUnsubscribe(query.data.u, query.data.list, query.data.t)
  )
    return { ok: false };
  const column =
    query.data.list === "digest"
      ? { digest_enabled: false }
      : { alerts_enabled: false };
  const { error } = await createAdminClient()
    .from("profiles")
    .update(column)
    .eq("id", query.data.u);
  if (error) throw new Error(error.message);
  return { ok: true, list: query.data.list };
}

/** Link in the email body: unsubscribe, then show a confirmation page. */
export async function GET(request: Request) {
  const result = await unsubscribe(request);
  if (!result.ok)
    return NextResponse.json({ error: "invalid_link" }, { status: 400 });
  return NextResponse.redirect(
    new URL(`/unsubscribed?list=${result.list}`, request.url),
    303,
  );
}

/** RFC 8058 one-click (mail clients POST "List-Unsubscribe=One-Click"). */
export async function POST(request: Request) {
  const result = await unsubscribe(request);
  if (!result.ok)
    return NextResponse.json({ error: "invalid_link" }, { status: 400 });
  return new NextResponse(null, { status: 200 });
}
