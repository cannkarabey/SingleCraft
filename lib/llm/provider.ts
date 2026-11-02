import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

export type Provider = "google" | "anthropic";
export type LlmTask = "story" | "studio" | "angle";

const PROVIDERS: readonly Provider[] = ["google", "anthropic"];

const TASK_ENV: Record<LlmTask, string> = {
  story: "LLM_STORY_MODEL",
  studio: "LLM_STUDIO_MODEL",
  angle: "LLM_STORY_MODEL", // personal angles use the cheap story model (plan §2)
};

/** "provider:model" → parts. Model ids may themselves contain colons. */
export function parseModelSpec(spec: string): {
  provider: Provider;
  model: string;
} {
  const index = spec.indexOf(":");
  const provider = spec.slice(0, index);
  const model = spec.slice(index + 1);
  if (index <= 0 || !model) {
    throw new Error(`Invalid model spec "${spec}": expected provider:model`);
  }
  if (!PROVIDERS.includes(provider as Provider)) {
    throw new Error(`Unknown LLM provider "${provider}" in "${spec}"`);
  }
  return { provider: provider as Provider, model };
}

function specFromEnv(name: string): string {
  const spec = process.env[name];
  if (!spec) throw new Error(`${name} is not set`);
  return spec;
}

export function isConfigured(...envNames: string[]): boolean {
  return envNames.every((name) => Boolean(process.env[name]));
}

export function storyPipelineConfigured(): boolean {
  return isConfigured("LLM_STORY_MODEL", "LLM_EMBED_MODEL");
}

export function getLanguageModel(task: LlmTask): {
  model: LanguageModel;
  id: string;
} {
  const spec = specFromEnv(TASK_ENV[task]);
  const { provider, model } = parseModelSpec(spec);
  return {
    model: provider === "google" ? google(model) : anthropic(model),
    id: spec,
  };
}

export function getEmbeddingModel(): { model: EmbeddingModel; id: string } {
  const spec = specFromEnv("LLM_EMBED_MODEL");
  const { provider, model } = parseModelSpec(spec);
  if (provider !== "google")
    throw new Error(`No embedding models for provider "${provider}"`);
  return { model: google.embeddingModel(model), id: spec };
}

/**
 * Conservative flat price (USD per million tokens) for the daily budget brake. It is a
 * safety ceiling, not billing: it over-estimates the cheap models the plan uses.
 */
const DEFAULT_PRICE_PER_MTOK = { input: 3, output: 15 };

export function estimateCostUsd(usage: {
  inputTokens?: number;
  outputTokens?: number;
}): number {
  return (
    ((usage.inputTokens ?? 0) * DEFAULT_PRICE_PER_MTOK.input +
      (usage.outputTokens ?? 0) * DEFAULT_PRICE_PER_MTOK.output) /
    1_000_000
  );
}
