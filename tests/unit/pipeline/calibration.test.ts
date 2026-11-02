import { describe, expect, test } from "vitest";
import golden from "@/tests/fixtures/calibration/near-duplicates.json";
import { DEDUPE } from "@/lib/pipeline/config";
import { hammingDistance, simhash } from "@/lib/pipeline/simhash";

// Golden set for the near-duplicate threshold (Faz 9 calibration). A threshold change
// must keep every labelled pair on the right side.
describe("near-duplicate calibration", () => {
  test.each(golden.pairs)("$label", ({ a, b, same }) => {
    const distance = hammingDistance(simhash(a), simhash(b));
    if (same)
      expect(distance).toBeLessThanOrEqual(DEDUPE.nearDuplicateDistance);
    else expect(distance).toBeGreaterThan(DEDUPE.nearDuplicateDistance);
  });

  test("labelled pairs keep a margin of at least 10 bits around the threshold", () => {
    const distances = golden.pairs.map((p) => ({
      same: p.same,
      d: hammingDistance(simhash(p.a), simhash(p.b)),
    }));
    const maxSame = Math.max(
      ...distances.filter((x) => x.same).map((x) => x.d),
    );
    const minDifferent = Math.min(
      ...distances.filter((x) => !x.same).map((x) => x.d),
    );
    expect(minDifferent - maxSame).toBeGreaterThanOrEqual(10);
  });

  test("cluster threshold stays at the spec's 0.85 (no embedding golden set yet)", () => {
    expect(DEDUPE.clusterThreshold).toBe(0.85);
  });
});
