import { embedMany, type EmbeddingModel } from "ai";

export const EMBEDDING_DIMENSIONS = 768;
const TIMEOUT_MS = 30_000;

/**
 * Embeds texts in order (the SDK batches per the model's per-call limit). Vectors must be
 * 768-dimensional to fit `vector(768)` columns; anything else is a configuration error.
 */
export async function embedTexts(
  texts: string[],
  deps: { model: EmbeddingModel; onUsage?: (tokens: number) => void },
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings, usage } = await embedMany({
    model: deps.model,
    values: texts,
    dimensions: EMBEDDING_DIMENSIONS,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  for (const embedding of embeddings) {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding has ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS} (check LLM_EMBED_MODEL)`,
      );
    }
  }
  deps.onUsage?.(usage.tokens);
  return embeddings;
}
