import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, unauthorized } from "@/lib/http";
import { emitNicheChanged } from "@/lib/radar/events";
import { createNiche, listNiches, NicheInput } from "@/lib/radar/niches";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!(await currentUser())) return unauthorized();
  return NextResponse.json({ niches: await listNiches(await createClient()) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = NicheInput.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);

  const result = await createNiche({
    admin: createAdminClient(),
    userId: user.id,
    input: parsed.data,
  });
  if (!result.ok) return NextResponse.json({ error: "limit" }, { status: 403 });
  await emitNicheChanged(result.niche.id);
  return NextResponse.json({ niche: result.niche }, { status: 201 });
}
