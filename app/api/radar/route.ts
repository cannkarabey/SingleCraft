import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { invalid, notFound, unauthorized } from "@/lib/http";
import { getRadar } from "@/lib/radar/feed";
import { listNiches } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

const Query = z.object({ niche: z.uuid().optional() });

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const query = Query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return invalid(query.error.issues);

  const db = await createClient();
  const [niches, { data: profile }] = await Promise.all([
    listNiches(db),
    db.from("profiles").select("plan").eq("id", user.id).single(),
  ]);
  const niche =
    niches.find((n) => n.id === query.data.niche) ??
    (query.data.niche ? undefined : niches[0]);
  if (!niche) return notFound();

  const radar = await getRadar(db, {
    nicheId: niche.id,
    plan: profile?.plan ?? null,
  });
  return NextResponse.json(
    { niche: { id: niche.id, name: niche.name }, ...radar },
    { headers: { "cache-control": "private, no-store" } },
  );
}
