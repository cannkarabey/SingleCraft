import { preCategory, type StoryCategory } from "./categories";
import type { DetectedLanguage } from "./language";
import type { Database } from "@/lib/supabase/types";

type SourceType = Database["public"]["Enums"]["source_type"];

export type FilterInput = {
  title: string;
  contentText: string;
  publishedAt: Date | null;
  language: DetectedLanguage | null;
};

export type FilterSource = {
  type: SourceType;
  trust_weight: number;
  config: { niche_specific?: boolean } & Record<string, unknown>;
};

export type RejectReason =
  "language" | "stale" | "too_short" | "spam" | "low_trust" | "off_niche";

export type FilterResult =
  | { status: "accepted"; category: StoryCategory }
  | { status: "rejected"; reason: RejectReason; category: StoryCategory };

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_EDITORIAL_LENGTH = 80;
const MIN_COMMUNITY_TITLE_LENGTH = 15;
const MIN_TRUST = 0.3;
const COMMUNITY_SOURCES: ReadonlySet<SourceType> = new Set([
  "hn",
  "reddit",
  "github",
  "producthunt",
]);
// Only phrases that are unambiguous in tech coverage: bare "airdrop", "betting" or
// "giveaway" show up in ordinary headlines (Apple AirDrop, "betting on AI").
const SPAM_PATTERN =
  /\b(crypto airdrop|token airdrop|online casino|sports betting|porn|escort service|buy followers|onlyfans|sponsored post)\b/i;

/** Rule-based pre-LLM filter (IMPLEMENTATION_PLAN §5.4). First failing rule wins. */
export function filterItem(
  item: FilterInput,
  source: FilterSource,
  now: Date,
): FilterResult {
  const text = `${item.title} ${item.contentText}`.trim();
  const category = preCategory(text);
  const reject = (reason: RejectReason): FilterResult => ({
    status: "rejected",
    reason,
    category,
  });

  if (item.language === "other") return reject("language");
  if (
    item.publishedAt &&
    now.getTime() - item.publishedAt.getTime() > MAX_AGE_MS
  ) {
    return reject("stale");
  }
  if (COMMUNITY_SOURCES.has(source.type)) {
    if (item.title.trim().length < MIN_COMMUNITY_TITLE_LENGTH)
      return reject("too_short");
  } else if (text.length < MIN_EDITORIAL_LENGTH) {
    return reject("too_short");
  }
  if (SPAM_PATTERN.test(text)) return reject("spam");
  if (source.trust_weight < MIN_TRUST) return reject("low_trust");
  if (source.config.niche_specific === false && category === "other")
    return reject("off_niche");

  return { status: "accepted", category };
}
