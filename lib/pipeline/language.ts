import { francAll } from "franc-min";

export type DetectedLanguage = "en" | "tr" | "other";

/** Below this length (e.g. a bare headline full of product names) detection is unreliable, so the language is left unknown. */
const MIN_LENGTH = 100;

/**
 * Trigram detection confuses jargon-heavy tech English with French/Romance languages
 * (loanwords like "development", "autonomous"). Rejecting is the costly mistake here, so
 * en/tr win whenever their score is within this ratio of the top language's score.
 */
const PREFERRED_MARGIN = 0.85;

const PREFERRED: Record<string, DetectedLanguage> = { eng: "en", tur: "tr" };

export function detectLanguage(text: string): DetectedLanguage | null {
  const scores = francAll(text, { minLength: MIN_LENGTH });
  const [topCode] = scores[0];
  if (topCode === "und") return null;
  if (PREFERRED[topCode]) return PREFERRED[topCode];

  const preferred = scores.find(([code]) => PREFERRED[code]);
  if (preferred && preferred[1] >= PREFERRED_MARGIN)
    return PREFERRED[preferred[0]];
  return "other";
}
