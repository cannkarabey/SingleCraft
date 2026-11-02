import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Runtime dependencies for pipeline steps, built fresh per step invocation. */
export function pipelineDeps() {
  const env = serverEnv();
  return {
    db: createAdminClient(),
    fetch: globalThis.fetch,
    now: new Date(),
    githubToken: env.GITHUB_TOKEN,
    productHuntToken: env.PRODUCTHUNT_TOKEN,
  };
}
