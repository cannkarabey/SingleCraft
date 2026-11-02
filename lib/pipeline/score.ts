import {
  EARLY_SIGNAL,
  ENGAGEMENT_CAPS,
  FRESHNESS_HALF_LIFE_HOURS,
  SCORE_WEIGHTS,
  VELOCITY,
} from "./config";
import type { SourceType } from "./types";

// Scoring (IMPLEMENTATION_PLAN §5.5). Weights and thresholds live in ./config.
export { EARLY_SIGNAL, ENGAGEMENT_CAPS, SCORE_WEIGHTS } from "./config";

/** Metrics whose growth drives velocity. */
const GROWTH_METRICS: Partial<Record<SourceType, string>> = {
  hn: "points",
  reddit: "upvotes",
  github: "stars",
  producthunt: "votes",
};

function cap(sourceType: SourceType, metric: string): number | undefined {
  return ENGAGEMENT_CAPS[sourceType]?.[metric];
}

export type MetricValue = {
  sourceType: SourceType;
  metric: string;
  value: number;
};

/** Log-scaled platform engagement; mean of the two strongest signals × 100. */
export function engagementScore(samples: MetricValue[]): number {
  const normalized = samples
    .flatMap(({ sourceType, metric, value }) => {
      const limit = cap(sourceType, metric);
      if (!limit) return [];
      return [
        Math.min(1, Math.log10(1 + Math.max(0, value)) / Math.log10(1 + limit)),
      ];
    })
    .sort((a, b) => b - a)
    .slice(0, 2);
  if (normalized.length === 0) return 0;
  return (normalized.reduce((sum, v) => sum + v, 0) / normalized.length) * 100;
}

export type MetricGrowth = {
  sourceType: SourceType;
  metric: string;
  latest: number;
  baseline: number;
};

/** Raw velocity: growth in the window relative to each cap, plus new sources in the window. */
export function velocityRaw(
  samples: MetricGrowth[],
  newSourcesInWindow: number,
): number {
  const growth = samples.reduce(
    (sum, { sourceType, metric, latest, baseline }) => {
      const limit = cap(sourceType, metric);
      if (!limit || GROWTH_METRICS[sourceType] !== metric) return sum;
      return sum + Math.max(0, latest - baseline) / limit;
    },
    0,
  );
  return growth + VELOCITY.newSourceWeight * newSourcesInWindow;
}

/** Percentile rank (0–100) of each value within the list; ties share the mid-rank. */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  return values.map((value) => {
    let below = 0;
    let equal = 0;
    for (const other of values) {
      if (other < value) below++;
      else if (other === value) equal++;
    }
    return ((below + 0.5 * equal) / n) * 100;
  });
}

export function sourceDiversityScore(
  distinctSources: number,
  distinctTypes: number,
): number {
  if (distinctSources <= 0) return 0;
  return (
    (0.7 * Math.min(1, (distinctSources - 1) / 5) +
      0.3 * Math.min(1, distinctTypes / 4)) *
    100
  );
}

export function freshnessScore(ageHours: number): number {
  return 100 * 2 ** (-Math.max(0, ageHours) / FRESHNESS_HALF_LIFE_HOURS);
}

/** Mean source trust (0–1). */
export function trustScore(weights: number[]): number {
  if (weights.length === 0) return 0;
  return weights.reduce((sum, w) => sum + w, 0) / weights.length;
}

export type SubScores = {
  velocity: number;
  engagement: number;
  diversity: number;
  freshness: number;
  trust: number;
};

/** Discover ranking: the Radar formula without NicheFit, rescaled to 0–100, times trust. */
export function globalScore(s: SubScores): number {
  const w = SCORE_WEIGHTS;
  const weighted =
    w.velocity * s.velocity +
    w.engagement * s.engagement +
    w.diversity * s.diversity +
    w.freshness * s.freshness;
  const total = w.velocity + w.engagement + w.diversity + w.freshness;
  return (weighted / total) * (0.7 + 0.3 * s.trust);
}

/** Rising fast but still little discussed (plan §5.6). */
export function isEarlySignal(s: {
  velocityPercentile: number;
  sourceCount: number;
  engagement: number;
  ageHours: number;
}): boolean {
  return (
    s.velocityPercentile >= EARLY_SIGNAL.minVelocityPercentile &&
    s.sourceCount <= EARLY_SIGNAL.maxSourceCount &&
    s.engagement <= EARLY_SIGNAL.maxEngagement &&
    s.ageHours < EARLY_SIGNAL.maxAgeHours
  );
}
