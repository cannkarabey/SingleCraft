import { serverEnv } from "@/lib/env";
import { recordUsage } from "@/lib/llm/budget";
import { getEmbeddingModel, getLanguageModel } from "@/lib/llm/provider";
import { embedTexts } from "@/lib/pipeline/embed";
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

/** Embedding function that records its token usage (job "embed"). */
export function embedDeps() {
  const base = pipelineDeps();
  const { model, id } = getEmbeddingModel();
  return {
    ...base,
    embed: async (texts: string[]) => {
      let tokens = 0;
      const vectors = await embedTexts(texts, {
        model,
        onUsage: (t) => (tokens = t),
      });
      await recordUsage(base.db, {
        job: "embed",
        model: id,
        inputTokens: tokens,
      });
      return vectors;
    },
  };
}

export function storyBuildDeps() {
  const env = serverEnv();
  return {
    db: createAdminClient(),
    llm: getLanguageModel("story"),
    now: new Date(),
    topN: env.STORY_BUILD_TOP_N,
    dailyLimit: env.STORY_BUILD_DAILY_LIMIT,
    budgetUsd: env.LLM_DAILY_BUDGET_USD,
  };
}
