import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_JOBS, adminRunEvent } from "@/lib/admin/jobs";
import { invalid, jsonBody, notFound } from "@/lib/http";

const Body = z.object({ job: z.enum(ADMIN_JOBS) });

/** Admin "run now" (plan §1 #10): sends the job's manual-trigger event. */
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return notFound();
  const body = Body.safeParse(await jsonBody(request));
  if (!body.success) return invalid(body.error.issues);
  try {
    await inngest.send({
      name: adminRunEvent(body.data.job),
      data: { by: user.id },
    });
  } catch {
    return NextResponse.json({ error: "enqueue_failed" }, { status: 502 });
  }
  return NextResponse.json({ queued: body.data.job }, { status: 202 });
}
