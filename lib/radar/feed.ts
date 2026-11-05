import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;
export type RadarStory =
  Database["public"]["Functions"]["radar_feed"]["Returns"][number];
export type Bucket = "high" | "early" | "gap";
export type RadarRow = RadarStory;
export type SavedStory = {
  id: string;
  slug: string | null;
  title: string | null;
  summary: string | null;
};

export type Radar = {
  high: RadarRow[];
  early: RadarRow[];
  gaps: RadarRow[];
  saved: SavedStory[];
};

const SECTIONS: Bucket[] = ["high", "early", "gap"];
const SAVED_LIMIT = 20;

function check<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as NonNullable<T>;
}

/**
 * The user's Radar for one niche (plan §5.6). radar_feed is service-role only (review C1),
 * so `userId` must come from the verified session.
 */
export async function getRadar({
  admin,
  userId,
  nicheId,
}: {
  admin: Db;
  userId: string;
  nicheId: string;
}): Promise<Radar> {
  const [feed, saved] = await Promise.all([
    admin.rpc("radar_feed", { p_niche: nicheId, p_user: userId }).then(check),
    savedStories(admin, userId),
  ]);
  const rows = SECTIONS.flatMap((bucket) =>
    feed.filter((row) => row.bucket === bucket),
  );
  return {
    high: rows.filter((r) => r.bucket === "high"),
    early: rows.filter((r) => r.bucket === "early"),
    gaps: rows.filter((r) => r.bucket === "gap"),
    saved,
  };
}

/** Stories the user saved (from Discover or Radar), newest first, regardless of niche fit. */
async function savedStories(admin: Db, userId: string): Promise<SavedStory[]> {
  const rows = check(
    await admin
      .from("user_signals")
      .select("created_at, stories!inner(id, slug, title, summary, status)")
      .eq("user_id", userId)
      .eq("action", "save")
      .eq("stories.status", "published")
      .order("created_at", { ascending: false })
      .limit(SAVED_LIMIT),
  );
  return rows.map(({ stories: s }) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    summary: s.summary,
  }));
}

export type SignalAction = "save" | "hide";

/** Save/hide through the user's client (RLS: own signals on published stories); idempotent. */
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
    .upsert(
      { user_id: userId, story_id: storyId, action },
      { onConflict: "user_id,story_id,action", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}
