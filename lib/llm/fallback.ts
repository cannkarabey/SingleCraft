import { GOOGLE_CHAIN, type ChainModel } from "./models";

const MINUTE_MS = 60_000;
const RPM_COOLDOWN_MS = 65_000;
const OVERLOAD_COOLDOWN_MS = 30_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Every model in the chain is cooling down or spent. `retryAfterSec` is the shortest wait. */
export class ModelsBusyError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`models_busy:${retryAfterSec}`);
  }
}

/** Shared state behind the chain; the database implementation lives in model-store.ts. */
export type ModelStore = {
  /** Models that must not be called yet, with the time they come back. */
  unavailable(now: Date): Promise<Map<string, Date>>;
  markUnavailable(id: string, until: Date, reason: string): Promise<void>;
  /** Calls recorded for a model since a point in time. */
  calls(id: string, since: Date): Promise<number>;
};

export const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const nextUtcMidnight = (now: Date) =>
  new Date(startOfUtcDay(now).getTime() + DAY_MS);

type ErrorLike = {
  name?: string;
  message?: string;
  statusCode?: number;
  responseBody?: string;
  lastError?: unknown;
};

/**
 * Whether an error means "try another model", and for how long this one rests: 429 for the
 * minute (65 s) or the day (until 00:00 UTC), 5xx and timeouts briefly, 404 (model closed
 * to this project) for a day. Anything else (bad request, schema) is the caller's bug.
 */
export function classifyError(
  error: unknown,
  now: Date,
): { until: Date; reason: string } | null {
  const e = error as ErrorLike;
  if (e?.lastError) return classifyError(e.lastError, now); // SDK RetryError wrapper
  const after = (ms: number) => new Date(now.getTime() + ms);
  if (e?.statusCode === 429) {
    const perDay = /PerDay/i.test(e.responseBody ?? "");
    return perDay
      ? { until: nextUtcMidnight(now), reason: "quota: requests per day" }
      : { until: after(RPM_COOLDOWN_MS), reason: "quota: requests per minute" };
  }
  if (e?.statusCode === 404)
    return {
      until: after(DAY_MS),
      reason: "model not available to this project",
    };
  if (e?.statusCode && e.statusCode >= 500)
    return {
      until: after(OVERLOAD_COOLDOWN_MS),
      reason: `HTTP ${e.statusCode}`,
    };
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return { until: after(OVERLOAD_COOLDOWN_MS), reason: "timeout" };
  return null;
}

/**
 * Runs `call` on the first model of the chain that is free, moving down the chain when a
 * model is rate-limited, overloaded or gone. Cooldowns go to the shared store so every
 * serverless invocation sees them. Throws ModelsBusyError when nothing is available.
 */
export async function runWithFallback<T>(
  deps: {
    store: ModelStore;
    chain?: readonly ChainModel[];
    now?: () => Date;
  },
  call: (modelId: string) => Promise<T>,
): Promise<{ value: T; modelId: string }> {
  const chain = deps.chain ?? GOOGLE_CHAIN;
  const clock = deps.now ?? (() => new Date());
  const blocked = await deps.store.unavailable(clock());
  const waits: Date[] = [];

  for (const model of chain) {
    const now = clock();
    const until = blocked.get(model.id);
    if (until && until > now) {
      waits.push(until);
      continue;
    }
    // Proactive: the configured limits say this model is spent, so do not waste a call.
    if ((await deps.store.calls(model.id, startOfUtcDay(now))) >= model.rpd) {
      waits.push(nextUtcMidnight(now));
      continue;
    }
    if (
      (await deps.store.calls(model.id, new Date(now.getTime() - MINUTE_MS))) >=
      model.rpm
    ) {
      waits.push(new Date(now.getTime() + RPM_COOLDOWN_MS));
      continue;
    }
    try {
      return { value: await call(model.id), modelId: model.id };
    } catch (error) {
      const verdict = classifyError(error, now);
      if (!verdict) throw error;
      await deps.store.markUnavailable(model.id, verdict.until, verdict.reason);
      waits.push(verdict.until);
    }
  }

  const soonest = Math.min(...waits.map((d) => d.getTime()));
  throw new ModelsBusyError(
    Math.max(1, Math.ceil((soonest - clock().getTime()) / 1000)),
  );
}
