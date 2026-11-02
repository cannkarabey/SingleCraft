import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { currentUser } from "@/lib/auth/session";
import { notFound, unauthorized } from "@/lib/http";
import { getAngle, requestAngle } from "@/lib/radar/angle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ storyId: string }> };
const StoryId = z.uuid();
const nicheParam = (request: Request) => {
  const niche = z
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("niche"));
  return niche.success ? niche.data : undefined;
};

/** Poll for a generated angle. */
export async function GET(request: Request, { params }: Ctx) {
  if (!(await currentUser())) return unauthorized();
  const storyId = StoryId.safeParse((await params).storyId);
  if (!storyId.success) return notFound();
  const angle = await getAngle(await createClient(), {
    storyId: storyId.data,
    nicheId: nicheParam(request),
  });
  return NextResponse.json(
    { angle },
    { headers: { "cache-control": "private, no-store" } },
  );
}

/** Request an angle: cached → 200 with it; queued → 202; daily limit → 429. */
export async function POST(request: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const storyId = StoryId.safeParse((await params).storyId);
  if (!storyId.success) return notFound();

  const db = await createClient();
  const { data: profile } = await db
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const result = await requestAngle({
    userDb: db,
    admin: createAdminClient(),
    userId: user.id,
    storyId: storyId.data,
    nicheId: nicheParam(request),
    plan: profile?.plan ?? null,
    send: (event) => inngest.send(event),
  });

  switch (result.status) {
    case "ready":
      return NextResponse.json({ angle: result.angle });
    case "queued":
      return NextResponse.json({ angle: null }, { status: 202 });
    case "limit":
      return NextResponse.json({ error: "limit" }, { status: 429 });
    case "no_niche":
      return notFound();
  }
}
