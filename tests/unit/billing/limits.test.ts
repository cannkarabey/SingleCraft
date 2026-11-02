import { describe, expect, test } from "vitest";
import { limitsFor, PLAN_LIMITS } from "@/lib/billing/limits";

describe("plan limits (plan §1 #7, PDF §15)", () => {
  test("free", () => {
    expect(PLAN_LIMITS.free).toEqual({
      niches: 1,
      radarRows: 3,
      briefsPerDay: 2,
      anglesPerDay: 5,
    });
  });

  test("creator", () => {
    expect(PLAN_LIMITS.creator).toEqual({
      niches: 3,
      radarRows: null,
      briefsPerDay: null,
      anglesPerDay: 50,
    });
  });

  test("pro allows more niches", () => {
    expect(PLAN_LIMITS.pro.niches).toBe(10);
  });

  test("unknown plans get free limits", () => {
    expect(limitsFor("enterprise-ish")).toEqual(PLAN_LIMITS.free);
    expect(limitsFor(null)).toEqual(PLAN_LIMITS.free);
  });
});
