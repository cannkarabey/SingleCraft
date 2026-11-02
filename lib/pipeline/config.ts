import type { SourceType } from "./types";

// Pipeline calibration knobs (IMPLEMENTATION_PLAN §5, Faz 9). Everything a calibration
// pass may tune lives here; the modules only implement the rules. Change a value together
// with the golden set in tests/fixtures/calibration/ and the admin panel's reject reasons.

const HOUR_MS = 60 * 60 * 1000;

/** §5.3 dedupe and clustering. */
export const DEDUPE = {
  /** How far back exact/near duplicates are looked up. */
  windowMs: 72 * HOUR_MS,
  /**
   * SimHash Hamming distance at or below which two items are the same text. Spec start
   * value was 3; the golden set showed a syndication suffix (" - The Verge") alone gives
   * 5, while separate stories sit at 28+. 6 keeps a wide margin on both sides.
   */
  nearDuplicateDistance: 6,
  /** Cosine similarity for joining a story cluster. */
  clusterThreshold: 0.85,
  /** How long a cluster stays open for new members. */
  clusterWindowMs: 72 * HOUR_MS,
} as const;

/** §5.4 rule-based filter. */
export const FILTER = {
  maxAgeMs: 7 * 24 * HOUR_MS,
  minEditorialLength: 80,
  /** HN link posts carry only a headline. */
  minHnTitleLength: 15,
  /** Reddit/GitHub/Product Hunt titles are short ("v17.0.0") but come with a body. */
  minCommunityLength: 30,
  minTrust: 0.3,
  communitySources: new Set<SourceType>(["reddit", "github", "producthunt"]),
  // Only phrases that are unambiguous in tech coverage: bare "airdrop", "betting" or
  // "giveaway" show up in ordinary headlines (Apple AirDrop, "betting on AI").
  spamPattern:
    /\b(crypto airdrop|token airdrop|online casino|sports betting|porn|escort service|buy followers|onlyfans|sponsored post)\b/i,
} as const;

/** §5.5 scoring. Every sub-score is 0–100 except trust (0–1). */
export const SCORE_WEIGHTS = {
  velocity: 0.35,
  engagement: 0.25,
  nicheFit: 0.2, // Radar only (Faz 5); excluded from global_score
  diversity: 0.1,
  freshness: 0.1,
} as const;

/** Value at which a platform metric counts as maximal engagement. */
export const ENGAGEMENT_CAPS: Partial<
  Record<SourceType, Record<string, number>>
> = {
  hn: { points: 500, comments: 300 },
  reddit: { upvotes: 2000 },
  github: { stars: 1000 },
  producthunt: { votes: 500 },
};

export const VELOCITY = {
  /** Weight of each newly joined source next to metric growth. */
  newSourceWeight: 0.5,
} as const;

export const FRESHNESS_HALF_LIFE_HOURS = 18;

/** §5.6 Early signal bucket. */
export const EARLY_SIGNAL = {
  minVelocityPercentile: 70,
  maxSourceCount: 3,
  maxEngagement: 50,
  maxAgeHours: 12,
} as const;
