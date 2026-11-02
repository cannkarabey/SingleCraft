import { badRequest, publicJson } from "@/lib/discover/http";
import { parseDiscoverQuery } from "@/lib/discover/params";
import { listStories } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

export async function GET(request: Request) {
  const parsed = parseDiscoverQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return badRequest(parsed.error);
  return publicJson(
    await listStories(createPublicClient(), {
      ...parsed.filters,
      now: new Date(),
    }),
  );
}
