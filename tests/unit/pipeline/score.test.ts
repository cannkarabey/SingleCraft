import { describe, expect, test } from "vitest";
import {
  engagementScore,
  freshnessScore,
  globalScore,
  isEarlySignal,
  percentileRanks,
  sourceDiversityScore,
  trustScore,
  velocityRaw,
} from "@/lib/pipeline/score";

describe("engagementScore", () => {
  test("no samples → 0", () => {
    expect(engagementScore([])).toBe(0);
  });

  test("value at the cap scores 100", () => {
    expect(
      engagementScore([{ sourceType: "hn", metric: "points", value: 500 }]),
    ).toBeCloseTo(100);
  });

  test("values above the cap are clamped", () => {
    expect(
      engagementScore([{ sourceType: "hn", metric: "points", value: 5000 }]),
    ).toBeCloseTo(100);
  });

  test("log scale", () => {
    const expected = (Math.log10(1 + 22) / Math.log10(1 + 500)) * 100;
    expect(
      engagementScore([{ sourceType: "hn", metric: "points", value: 22 }]),
    ).toBeCloseTo(expected);
  });

  test("mean of the two highest normalized values", () => {
    const score = engagementScore([
      { sourceType: "hn", metric: "points", value: 500 }, // 1.0
      { sourceType: "github", metric: "stars", value: 1000 }, // 1.0
      { sourceType: "hn", metric: "comments", value: 0 }, // 0
    ]);
    expect(score).toBeCloseTo(100);
  });

  test("unknown platform/metric pairs are ignored", () => {
    expect(
      engagementScore([{ sourceType: "youtube", metric: "views", value: 1e6 }]),
    ).toBe(0);
  });
});

describe("velocityRaw", () => {
  test("sums growth relative to caps plus new sources", () => {
    const raw = velocityRaw(
      [
        { sourceType: "hn", metric: "points", latest: 300, baseline: 50 }, // 250/500 = 0.5
        { sourceType: "github", metric: "stars", latest: 1500, baseline: 1000 }, // 500/1000 = 0.5
      ],
      2, // 2 × 0.5
    );
    expect(raw).toBeCloseTo(2);
  });

  test("decreases never count negative", () => {
    expect(
      velocityRaw(
        [{ sourceType: "hn", metric: "points", latest: 10, baseline: 50 }],
        0,
      ),
    ).toBe(0);
  });

  test("non-growth metrics are ignored", () => {
    expect(
      velocityRaw(
        [{ sourceType: "hn", metric: "comments", latest: 300, baseline: 0 }],
        0,
      ),
    ).toBe(0);
  });
});

describe("percentileRanks", () => {
  test("empty input", () => {
    expect(percentileRanks([])).toEqual([]);
  });

  test("single value is the median", () => {
    expect(percentileRanks([7])).toEqual([50]);
  });

  test("ranks with ties", () => {
    expect(percentileRanks([1, 2, 2, 3])).toEqual([12.5, 50, 50, 87.5]);
  });
});

describe("sourceDiversityScore", () => {
  test("one source scores only the type part", () => {
    expect(sourceDiversityScore(1, 1)).toBeCloseTo(7.5);
  });

  test("six sources of four types score 100", () => {
    expect(sourceDiversityScore(6, 4)).toBeCloseTo(100);
  });

  test("no sources → 0", () => {
    expect(sourceDiversityScore(0, 0)).toBe(0);
  });
});

describe("freshnessScore", () => {
  test("100 when new, 50 after 18 h, never above 100", () => {
    expect(freshnessScore(0)).toBe(100);
    expect(freshnessScore(18)).toBeCloseTo(50);
    expect(freshnessScore(-3)).toBe(100);
  });
});

describe("trustScore", () => {
  test("mean of source weights, 0 when empty", () => {
    expect(trustScore([0.9, 0.7])).toBeCloseTo(0.8);
    expect(trustScore([])).toBe(0);
  });
});

describe("globalScore", () => {
  test("all 100 with full trust → 100", () => {
    expect(
      globalScore({
        velocity: 100,
        engagement: 100,
        diversity: 100,
        freshness: 100,
        trust: 1,
      }),
    ).toBeCloseTo(100);
  });

  test("weights and trust multiplier", () => {
    const base = (0.35 * 80 + 0.25 * 60 + 0.1 * 40 + 0.1 * 20) / 0.8;
    expect(
      globalScore({
        velocity: 80,
        engagement: 60,
        diversity: 40,
        freshness: 20,
        trust: 0.5,
      }),
    ).toBeCloseTo(base * (0.7 + 0.3 * 0.5));
  });
});

describe("isEarlySignal", () => {
  const early = {
    velocityPercentile: 80,
    sourceCount: 2,
    engagement: 30,
    ageHours: 4,
  };
  test("all conditions met", () => {
    expect(isEarlySignal(early)).toBe(true);
  });
  test.each([
    ["velocity too low", { velocityPercentile: 69 }],
    ["too many sources", { sourceCount: 4 }],
    ["already engaged", { engagement: 51 }],
    ["too old", { ageHours: 12 }],
  ])("%s", (_, override) => {
    expect(isEarlySignal({ ...early, ...override })).toBe(false);
  });
});
