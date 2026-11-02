import { z } from "zod";
import { badRequest, publicJson } from "@/lib/discover/http";
import { categoryCounts, RANGES } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const Query = z.object({
  range: z.enum(RANGES as ["today", "24h", "week"]).default("24h"),
});

export async function GET(request: Request) {
  const parsed = Query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return badRequest(parsed.error.issues.map((i) => i.message));
  return publicJson({
    counts: await categoryCounts(createPublicClient(), {
      range: parsed.data.range,
      now: new Date(),
    }),
  });
}
