import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { unauthorized } from "@/lib/http";
import { listBriefs } from "@/lib/studio/briefs";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!(await currentUser())) return unauthorized();
  const filter = new URL(request.url).searchParams.get("status");
  const briefs = await listBriefs(
    await createClient(),
    filter === "published" || filter === "draft" ? filter : undefined,
  );
  return NextResponse.json(
    { briefs },
    { headers: { "cache-control": "private, no-store" } },
  );
}
