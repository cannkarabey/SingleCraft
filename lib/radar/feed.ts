import type { SupabaseClient } from "@supabase/supabase-js";
import { limitsFor } from "@/lib/billing/limits";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;
export type RadarStory =
  Database["public"]["Functions"]["radar_feed"]["Returns"][number];
export type Bucket = "high" | "early" | "gap";
export type RadarRow =
  (RadarStory & { locked: false }) | { locked: true; bucket: Bucket };

export type Radar = {
  high: RadarRow[];
  early: RadarRow[];
  gaps: RadarRow[];
  lockedCount: number;
};

const SECTIONS: Bucket[] = ["high", "early", "gap"];

/**
 * The user's Radar for one niche (plan §5.6), with the plan's row limit applied here on
 * the server (plan §1 #19): rows past the limit carry only their bucket, never content.
 * `userDb` must be the user's own client — radar_feed rejects other users' niches.
 */
export async function getRadar(
  userDb: Db,
  { nicheId, plan }: { nicheId: string; plan: string | null },
): Promise<Radar> {
  const { data, error } = await userDb.rpc("radar_feed", { p_niche: nicheId });
  if (error) throw new Error(error.message);

  const limit = limitsFor(plan).radarRows;
  const ordered = SECTIONS.flatMap((bucket) =>
    data.filter((row) => row.bucket === bucket),
  );
  let shown = 0;
  let lockedCount = 0;
  const rows: RadarRow[] = ordered.map((row) => {
    if (limit === null || shown < limit) {
      shown++;
      return { ...row, locked: false };
    }
    lockedCount++;
    return { locked: true, bucket: row.bucket as Bucket };
  });

  return {
    high: rows.filter((r) => r.bucket === "high"),
    early: rows.filter((r) => r.bucket === "early"),
    gaps: rows.filter((r) => r.bucket === "gap"),
    lockedCount,
  };
}

export type SignalAction = "save" | "hide";

/** Save/hide through the user's client; RLS allows only their own signals on published stories. */
export async function recordSignal(
  userDb: Db,
  {
    userId,
    storyId,
    action,
  }: { userId: string; storyId: string; action: SignalAction },
) {
  const { error } = await userDb
    .from("user_signals")
    .insert({ user_id: userId, story_id: storyId, action });
  if (error) throw new Error(error.message);
}
