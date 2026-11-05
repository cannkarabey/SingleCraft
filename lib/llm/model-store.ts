import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModelStore } from "./fallback";
import { usageName } from "./models";

type Db = SupabaseClient<Database>;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** ModelStore on Postgres: cooldowns in `llm_model_state`, call counts from `llm_usage`. */
export function dbModelStore(db: Db): ModelStore {
  return {
    async unavailable(now) {
      const { data, error } = await db
        .from("llm_model_state")
        .select("model, unavailable_until")
        .gt("unavailable_until", now.toISOString());
      fail(error);
      return new Map(
        (data ?? []).map((r) => [r.model, new Date(r.unavailable_until)]),
      );
    },
    async markUnavailable(id, until, reason) {
      // Never shorten a rest that is already longer (a day-long ban beats a minute).
      const { data } = await db
        .from("llm_model_state")
        .select("unavailable_until")
        .eq("model", id)
        .maybeSingle();
      if (data && new Date(data.unavailable_until) > until) return;
      const { error } = await db.from("llm_model_state").upsert({
        model: id,
        unavailable_until: until.toISOString(),
        reason,
        updated_at: new Date().toISOString(),
      });
      fail(error);
    },
    async calls(id, since) {
      const { count, error } = await db
        .from("llm_usage")
        .select("id", { count: "exact", head: true })
        .eq("model", usageName(id))
        .gte("created_at", since.toISOString());
      fail(error);
      return count ?? 0;
    },
  };
}
