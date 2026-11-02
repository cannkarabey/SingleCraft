import { describe, expect, test } from "vitest";
import { newSourceCount, pacedBuildLimit } from "@/lib/pipeline/stories";

describe("pacedBuildLimit (review I1)", () => {
  test("spreads the remaining daily calls over the remaining runs", () => {
    // 23:00 UTC → 2 runs of 30 min left today
    const now = new Date("2026-11-02T23:00:00Z");
    expect(
      pacedBuildLimit({ remaining: 10, now, intervalMinutes: 30, topN: 30 }),
    ).toBe(5);
  });

  test("right after midnight a full day of runs shares the cap", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(
      pacedBuildLimit({ remaining: 40, now, intervalMinutes: 30, topN: 30 }),
    ).toBe(1);
  });

  test("never exceeds topN or the remaining calls", () => {
    const now = new Date("2026-11-02T23:50:00Z");
    expect(
      pacedBuildLimit({ remaining: 40, now, intervalMinutes: 30, topN: 30 }),
    ).toBe(30);
    expect(
      pacedBuildLimit({ remaining: 0, now, intervalMinutes: 30, topN: 30 }),
    ).toBe(0);
  });
});

describe("newSourceCount (review I5)", () => {
  const windowStart = new Date("2026-11-02T06:00:00Z");
  const at = (h: number) =>
    new Date(`2026-11-02T${String(h).padStart(2, "0")}:00:00Z`).toISOString();

  test("the seed item does not count as a new source", () => {
    expect(
      newSourceCount(
        [{ raw_item_id: 1, source_id: "a", fetched_at: at(10) }],
        windowStart,
      ),
    ).toBe(0);
  });

  test("counts distinct sources that joined inside the window after the seed", () => {
    expect(
      newSourceCount(
        [
          { raw_item_id: 1, source_id: "a", fetched_at: at(10) },
          { raw_item_id: 2, source_id: "b", fetched_at: at(11) },
          { raw_item_id: 3, source_id: "b", fetched_at: at(11) },
          { raw_item_id: 4, source_id: "c", fetched_at: at(12) },
          { raw_item_id: 5, source_id: "d", fetched_at: at(3) }, // seed: earliest member
        ],
        windowStart,
      ),
    ).toBe(3);
  });

  test("the seed's own source posting again is not a new source", () => {
    expect(
      newSourceCount(
        [
          { raw_item_id: 1, source_id: "a", fetched_at: at(10) },
          { raw_item_id: 2, source_id: "a", fetched_at: at(11) },
        ],
        windowStart,
      ),
    ).toBe(0);
  });
});
