import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { notFound, unauthorized } from "@/lib/http";
import { recordSignal } from "@/lib/radar/feed";
import { createClient } from "@/lib/supabase/server";

const Params = z.object({
  storyId: z.uuid(),
  action: z.enum(["save", "hide"]),
});

/** POST /api/radar/[storyId]/save | /hide (plan §7). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string; action: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = Params.safeParse(await params);
  if (!parsed.success) return notFound();
  try {
    await recordSignal(await createClient(), {
      userId: user.id,
      ...parsed.data,
    });
  } catch {
    // RLS rejects unpublished/unknown stories.
    return notFound();
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
