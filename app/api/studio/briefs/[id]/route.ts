import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { invalid, jsonBody, notFound, unauthorized } from "@/lib/http";
import { EditInput, getBrief, saveEdits } from "@/lib/studio/briefs";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.uuid();

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await currentUser())) return unauthorized();
  const id = Id.safeParse((await params).id);
  if (!id.success) return notFound();
  const brief = await getBrief(await createClient(), id.data);
  if (!brief) return notFound();
  return NextResponse.json(brief, {
    headers: { "cache-control": "private, no-store" },
  });
}

/** Autosave of the user's edits and chosen hook. */
export async function PUT(request: Request, { params }: Ctx) {
  if (!(await currentUser())) return unauthorized();
  const id = Id.safeParse((await params).id);
  if (!id.success) return notFound();
  const body = EditInput.safeParse(await jsonBody(request));
  if (!body.success) return invalid(body.error.issues);
  if (!(await saveEdits(await createClient(), id.data, body.data)))
    return notFound();
  return NextResponse.json({ ok: true });
}
