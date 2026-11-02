import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, notFound, unauthorized } from "@/lib/http";
import { emitNicheChanged } from "@/lib/radar/events";
import { NicheInput, updateNiche } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await currentUser())) return unauthorized();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const parsed = NicheInput.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);

  const niche = await updateNiche(await createClient(), id.data, parsed.data);
  if (!niche) return notFound();
  await emitNicheChanged(niche.id);
  return NextResponse.json({ niche });
}
