import { expect, test } from "vitest";
import { seedTime } from "../e2e/support/seed";

// Review I5: e2e stories must fall inside Discover's default "today" (since 00:00 UTC).
test("clamps 'hours ago' to the current UTC day for today's stories", () => {
  const now = new Date("2026-11-03T00:30:00Z");
  expect(new Date(seedTime(2, now)).getTime()).toBeGreaterThanOrEqual(
    Date.parse("2026-11-03T00:00:00Z"),
  );
  expect(new Date(seedTime(2, now)).getTime()).toBeLessThan(now.getTime());
});

test("leaves times alone when they are already today", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  expect(seedTime(2, now)).toBe("2026-11-03T10:00:00.000Z");
});

test("old stories can still be days old", () => {
  const now = new Date("2026-11-03T00:30:00Z");
  expect(seedTime(72, now, { allowPastDays: true })).toBe(
    "2026-10-31T00:30:00.000Z",
  );
});
