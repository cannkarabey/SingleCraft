import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { SourceUpdate, updateSource } from "@/lib/admin/queries";
import { invalid, jsonBody, notFound } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin: turn a source on/off or change its trust weight (plan §8.2). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const body = SourceUpdate.safeParse(await jsonBody(request));
  if (!body.success) return invalid(body.error.issues);
  if (!(await updateSource(createAdminClient(), id.data, body.data)))
    return notFound();
  return NextResponse.json({ ok: true });
}
