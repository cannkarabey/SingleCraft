import { z } from "zod";
import { badRequest, publicJson } from "@/lib/discover/http";
import {
  githubPanel,
  newToolsPanel,
  trendingPanel,
} from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const PANELS = {
  trending: trendingPanel,
  new_tools: newToolsPanel,
  github: githubPanel,
};
const Query = z.object({
  panel: z.enum(["trending", "new_tools", "github"]).default("trending"),
});

export async function GET(request: Request) {
  const parsed = Query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return badRequest(parsed.error.issues.map((i) => i.message));
  return publicJson({
    items: await PANELS[parsed.data.panel](createPublicClient(), new Date()),
  });
}
