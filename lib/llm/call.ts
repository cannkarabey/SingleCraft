import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { runWithFallback } from "./fallback";
import { dbModelStore } from "./model-store";
import { usageName } from "./models";

/** A language model plus its usage name; `auto` marks the free-tier fallback chain. */
export type LlmHandle = { model: LanguageModel; id: string; auto?: boolean };

/** In chain mode the chain moves on at once; SDK retries on one model would only waste quota. */
export const llmRetries = (llm: LlmHandle) => (llm.auto ? 0 : 1);

/**
 * Runs one LLM call. A plain model is called as is; in chain mode the call goes to the
 * first free model of the Gemini chain. Returns the model that answered, as named in
 * `llm_usage`.
 */
export async function callLlm<T>(
  deps: { db: SupabaseClient<Database>; llm: LlmHandle },
  run: (model: LanguageModel) => Promise<T>,
): Promise<{ value: T; modelId: string }> {
  if (!deps.llm.auto)
    return { value: await run(deps.llm.model), modelId: deps.llm.id };
  const { value, modelId } = await runWithFallback(
    { store: dbModelStore(deps.db) },
    (id) => run(google(id)),
  );
  return { value, modelId: usageName(modelId) };
}
