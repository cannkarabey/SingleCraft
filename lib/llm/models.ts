/** Model spec that turns on the free-tier fallback chain (LLM_STORY_MODEL=google:auto). */
export const GOOGLE_AUTO = "google:auto";

export type ChainModel = { id: string; rpm: number; rpd: number };

/**
 * Priority order with the Gemini free-tier limits from the AI Studio dashboard. The numbers
 * only let us skip a model that is surely spent; Google's own 429 stays the authority.
 * Models a project cannot use (404) are switched off at runtime, so a stale entry is safe.
 */
export const GOOGLE_CHAIN: readonly ChainModel[] = [
  { id: "gemini-3.5-flash-lite", rpm: 15, rpd: 500 },
  { id: "gemini-3.1-flash-lite", rpm: 15, rpd: 500 },
  { id: "gemini-2.5-flash-lite", rpm: 10, rpd: 20 },
  { id: "gemini-3.8-flash", rpm: 5, rpd: 20 },
  { id: "gemini-3.6-flash", rpm: 5, rpd: 20 },
  { id: "gemini-3-flash-preview", rpm: 5, rpd: 20 },
  { id: "gemini-2.5-flash", rpm: 5, rpd: 20 },
];

/** How `llm_usage.model` names a chain model. */
export const usageName = (id: string) => `google:${id}`;
