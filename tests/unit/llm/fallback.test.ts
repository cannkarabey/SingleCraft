import { describe, expect, test } from "vitest";
import {
  classifyError,
  ModelsBusyError,
  runWithFallback,
  startOfUtcDay,
  type ModelStore,
} from "@/lib/llm/fallback";
import type { ChainModel } from "@/lib/llm/models";

const CHAIN: ChainModel[] = [
  { id: "a", rpm: 15, rpd: 500 },
  { id: "b", rpm: 15, rpd: 500 },
  { id: "c", rpm: 5, rpd: 20 },
];
const T0 = new Date("2026-11-05T10:00:00Z");

const apiError = (statusCode: number, responseBody = "") =>
  Object.assign(new Error(`HTTP ${statusCode}`), { statusCode, responseBody });

/** In-memory ModelStore with a movable clock and recorded calls. */
function harness() {
  let clock = T0;
  const rests = new Map<string, Date>();
  const called: { id: string; at: Date }[] = [];
  const store: ModelStore = {
    unavailable: async (now) =>
      new Map([...rests].filter(([, until]) => until > now)),
    markUnavailable: async (id, until) => {
      rests.set(id, until);
    },
    calls: async (id, since) =>
      called.filter((c) => c.id === id && c.at >= since).length,
  };
  const run = (behaviour: Record<string, () => unknown>) =>
    runWithFallback({ store, chain: CHAIN, now: () => clock }, async (id) => {
      const result = behaviour[id]?.();
      if (result instanceof Error) throw result;
      called.push({ id, at: clock });
      return result ?? id;
    });
  return {
    run,
    rests,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
    at: (iso: string) => (clock = new Date(iso)),
    called,
  };
}

describe("runWithFallback", () => {
  test("uses the first model while it works", async () => {
    const h = harness();
    expect((await h.run({})).modelId).toBe("a");
  });

  test("a per-minute 429 rests the model for 65 s and the call moves on", async () => {
    const h = harness();
    const out = await h.run({ a: () => apiError(429, "PerMinute") });
    expect(out.modelId).toBe("b");
    expect(h.rests.get("a")!.getTime() - T0.getTime()).toBe(65_000);
  });

  test("a rested model is skipped, then used again once its rest is over", async () => {
    const h = harness();
    await h.run({ a: () => apiError(429, "PerMinute") });
    h.advance(30_000);
    expect((await h.run({})).modelId).toBe("b"); // still resting
    h.advance(40_000); // 70 s after the 429
    expect((await h.run({})).modelId).toBe("a");
  });

  test("a per-day 429 rests the model until 00:00 UTC", async () => {
    const h = harness();
    await h.run({
      a: () => apiError(429, '{"quotaId":"GenerateRequestsPerDayPerProject"}'),
    });
    expect(h.rests.get("a")!.toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  test("overload (503), timeouts and a closed model (404) all fall through", async () => {
    const h = harness();
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    const out = await h.run({
      a: () => apiError(503),
      b: () => timeout,
      c: () => 1,
    });
    expect(out.modelId).toBe("c");
    const closed = harness();
    await closed.run({ a: () => apiError(404) });
    expect(closed.rests.get("a")!.getTime() - T0.getTime()).toBe(24 * 3600_000);
  });

  test("a bad request is the caller's bug: no fallback, no rest", async () => {
    const h = harness();
    await expect(h.run({ a: () => apiError(400) })).rejects.toThrow("HTTP 400");
    expect(h.rests.size).toBe(0);
  });

  test("a model whose daily limit is spent is skipped without a call", async () => {
    const h = harness();
    const hour = new Date(T0.getTime() + 3600_000);
    h.rests.set("a", hour);
    h.rests.set("b", hour);
    for (let i = 0; i < 20; i++)
      h.called.push({ id: "c", at: startOfUtcDay(T0) }); // c allows 20/day
    await expect(h.run({})).rejects.toMatchObject({ retryAfterSec: 3600 });
    expect(h.called.filter((c) => c.id === "c")).toHaveLength(20); // no 21st call
  });

  test("a model at its per-minute limit is skipped until the window moves on", async () => {
    const h = harness();
    const hour = new Date(T0.getTime() + 3600_000);
    h.rests.set("a", hour);
    h.rests.set("b", hour);
    for (let i = 0; i < 5; i++) h.called.push({ id: "c", at: T0 }); // c allows 5/min
    await expect(h.run({})).rejects.toMatchObject({ retryAfterSec: 65 });
    h.advance(61_000); // the five calls have left the 60 s window
    expect((await h.run({})).modelId).toBe("c");
  });

  test("when every model rests, the error says how long to wait", async () => {
    const h = harness();
    await expect(
      h.run({
        a: () => apiError(429, "PerMinute"),
        b: () => apiError(503),
        c: () => apiError(429, "PerMinute"),
      }),
    ).rejects.toMatchObject({ retryAfterSec: 30 }); // b (503) comes back first
    await expect(h.run({})).rejects.toBeInstanceOf(ModelsBusyError);
  });
});

describe("classifyError", () => {
  test("looks through the SDK's retry wrapper", () => {
    const wrapped = Object.assign(new Error("retries"), {
      lastError: apiError(429, "PerMinute"),
    });
    expect(classifyError(wrapped, T0)?.reason).toMatch(/minute/);
  });
  test("unknown errors are not retryable", () => {
    expect(classifyError(new Error("zod"), T0)).toBeNull();
  });
});
