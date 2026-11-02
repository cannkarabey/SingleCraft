import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

/**
 * Claims an email_log row before sending. The unique indexes make this the dedupe point:
 * false means another run already sent (or is sending) this email.
 */
export async function claimEmail(
  db: Db,
  row: {
    user_id: string;
    kind: "digest" | "alert";
    day: string;
    story_id?: string;
  },
): Promise<number | null> {
  const { data, error } = await db
    .from("email_log")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }
  return data?.id ?? null;
}

export async function confirmEmail(db: Db, id: number, providerId: string) {
  await db.from("email_log").update({ provider_id: providerId }).eq("id", id);
}

/** A failed send gives the claim back so the next run retries it. */
export async function releaseEmail(db: Db, id: number) {
  await db.from("email_log").delete().eq("id", id);
}

/** Local calendar day of `now` in an IANA timezone, as YYYY-MM-DD. */
export function localDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
