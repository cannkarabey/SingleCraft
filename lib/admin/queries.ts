import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;
const DAY_MS = 24 * 60 * 60 * 1000;
const SPEND_DAYS = 14;
const REJECT_WINDOW_DAYS = 7;
const RECENT_RUNS = 30;
const RECENT_REJECTED = 50;
const RECENT_FEEDBACK = 50;

function check<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as NonNullable<T>;
}

/** Everything `/admin` shows (plan §8.2), read with the service role. */
export async function adminOverview(db: Db, now: Date) {
  const [sources, runs, spend, rejectReasons, rejected, feedback] =
    await Promise.all([
      db
        .from("sources")
        .select(
          "id, name, type, active, trust_weight, last_fetched_at, last_error, consecutive_failures",
        )
        .order("name")
        .then(check),
      db
        .from("pipeline_runs")
        .select("id, fn, started_at, finished_at, stats, error")
        .order("started_at", { ascending: false })
        .limit(RECENT_RUNS)
        .then(check),
      db
        .rpc("admin_llm_spend", {
          p_days: SPEND_DAYS,
          p_now: now.toISOString(),
        })
        .then(check),
      db
        .rpc("admin_reject_reasons", {
          p_since: new Date(
            now.getTime() - REJECT_WINDOW_DAYS * DAY_MS,
          ).toISOString(),
        })
        .then(check),
      db
        .from("raw_items")
        .select("id, title, url, reject_reason, fetched_at, sources(name)")
        .eq("filter_status", "rejected")
        .order("fetched_at", { ascending: false })
        .limit(RECENT_REJECTED)
        .then(check),
      db
        .from("feedback")
        .select("id, user_id, message, page, created_at")
        .order("created_at", { ascending: false })
        .limit(RECENT_FEEDBACK)
        .then(check),
    ]);
  return {
    sources,
    runs,
    spend: spend.map((d) => ({ ...d, cost_usd: Number(d.cost_usd) })),
    rejectReasons,
    rejected,
    feedback,
  };
}

export type AdminOverview = Awaited<ReturnType<typeof adminOverview>>;

export const SourceUpdate = z
  .object({
    active: z.boolean().optional(),
    trust_weight: z.number().min(0).max(1).multipleOf(0.01).optional(),
  })
  .refine((v) => v.active !== undefined || v.trust_weight !== undefined, {
    message: "nothing to update",
  });

/** false = unknown source. Re-activating clears the failure streak that disabled it. */
export async function updateSource(
  db: Db,
  id: string,
  input: z.infer<typeof SourceUpdate>,
) {
  const { data, error } = await db
    .from("sources")
    .update({
      ...input,
      ...(input.active ? { consecutive_failures: 0 } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}
