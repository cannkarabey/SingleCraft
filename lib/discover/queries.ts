import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Read side of Discover (plan §7, §8.2). Every function takes the caller's Supabase
// client: public pages pass the anon/session client, so RLS decides what is visible.

type Db = SupabaseClient<Database>;
export type StoryCategory = Database["public"]["Enums"]["story_category"];
export type Range = "today" | "24h" | "week";
export const RANGES: readonly Range[] = ["today", "24h", "week"];
export const CATEGORIES: readonly StoryCategory[] = [
  "ai_models",
  "ai_tools",
  "developer_tools",
  "open_source",
  "startups",
  "security",
  "web_frontend",
  "mobile",
  "data_infra",
  "other",
];

const HOUR_MS = 3600_000;
const MAX_OFFSET = 500;
const PANEL_SIZE = 5;

const CARD_FIELDS =
  "id, slug, title, summary, why_it_matters, category, global_score, velocity_score, trust_score, is_early_signal, source_count, first_seen_at";

export type Signals = Omit<
  Database["public"]["Functions"]["discover_story_signals"]["Returns"][number],
  "story_id"
>;

type CardRow = {
  id: string;
  slug: string | null;
  title: string | null;
  summary: string | null;
  why_it_matters: string | null;
  category: StoryCategory | null;
  global_score: number;
  velocity_score: number;
  trust_score: number;
  is_early_signal: boolean;
  source_count: number;
  first_seen_at: string;
};
export type StoryCard = CardRow & { signals: Signals | null };

function check<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as NonNullable<T>;
}

/** Start of the range. "today" = since 00:00 UTC (no timezone for anonymous visitors). */
export function rangeStart(range: Range, now: Date): Date {
  if (range === "today") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
  return new Date(now.getTime() - (range === "24h" ? 24 : 7 * 24) * HOUR_MS);
}

// Offset cursor: scores are recomputed every 30 min, so a keyset on a float score is no
// more stable than an offset, and offsets are capped to keep queries cheap.
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const { o } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(o) && o >= 0 && o <= MAX_OFFSET ? o : 0;
  } catch {
    return 0;
  }
}

async function withSignals(db: Db, rows: CardRow[]): Promise<StoryCard[]> {
  if (rows.length === 0) return [];
  const signals = check(
    await db.rpc("discover_story_signals", {
      p_story_ids: rows.map((r) => r.id),
    }),
  );
  const byStory = new Map(
    signals.map(({ story_id, ...rest }) => [story_id, rest]),
  );
  return rows.map((row) => ({ ...row, signals: byStory.get(row.id) ?? null }));
}

export type ListParams = {
  range: Range;
  category?: StoryCategory;
  q?: string;
  cursor?: string;
  limit?: number;
  now: Date;
};

export async function listStories(
  db: Db,
  params: ListParams,
): Promise<{ items: StoryCard[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const offset = decodeCursor(params.cursor);

  let query = db
    .from("stories")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .gte("first_seen_at", rangeStart(params.range, params.now).toISOString());
  if (params.category) query = query.eq("category", params.category);
  if (params.q?.trim()) {
    query = query.textSearch("search", params.q.trim(), {
      type: "websearch",
      config: "simple",
    });
  }
  const rows = check(
    await query
      .order("global_score", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit),
  ) as CardRow[];

  const hasMore = rows.length > limit && offset + limit < MAX_OFFSET;
  return {
    items: await withSignals(db, rows.slice(0, limit)),
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStory(db: Db, idOrSlug: string) {
  const query = db
    .from("stories")
    .select(
      `${CARD_FIELDS}, entities, suggested_angles, sentiment, engagement_score, source_diversity_score, freshness_score, last_updated_at`,
    )
    .eq("status", "published");
  const { data, error } = await (
    UUID.test(idOrSlug) ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug)
  ).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [sources, [card], trend] = await Promise.all([
    db.rpc("discover_story_sources", { p_story_id: data.id }).then(check),
    withSignals(db, [data as CardRow]),
    storyTrend(db, data.id),
  ]);
  return { ...data, signals: card.signals, sources, trend };
}

export type StoryDetail = NonNullable<Awaited<ReturnType<typeof getStory>>>;

/** global_score history for the sparkline (trend_scores is public for published stories). */
export async function storyTrend(db: Db, storyId: string) {
  return check(
    await db
      .from("trend_scores")
      .select("value, calculated_at")
      .eq("story_id", storyId)
      .eq("metric", "global")
      .order("calculated_at", { ascending: true })
      .limit(96),
  );
}

/** Published stories per category in the range. */
export async function categoryCounts(
  db: Db,
  params: { range: Range; now: Date },
): Promise<Partial<Record<StoryCategory, number>>> {
  const rows = check(
    await db
      .from("stories")
      .select("category")
      .eq("status", "published")
      .gte("first_seen_at", rangeStart(params.range, params.now).toISOString())
      .limit(1000),
  );
  const counts: Partial<Record<StoryCategory, number>> = {};
  for (const { category } of rows) {
    if (category) counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

export type PanelItem = {
  id: string;
  slug: string | null;
  title: string | null;
  value: number;
};

/** Fastest-rising published stories of the last 24 h. */
export async function trendingPanel(db: Db, now: Date): Promise<PanelItem[]> {
  const rows = check(
    await db
      .from("stories")
      .select("id, slug, title, velocity_score")
      .eq("status", "published")
      .gte("first_seen_at", rangeStart("24h", now).toISOString())
      .order("velocity_score", { ascending: false })
      .limit(PANEL_SIZE),
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    value: r.velocity_score,
  }));
}

/** New AI tools: best ai_tools stories of the week. */
export async function newToolsPanel(db: Db, now: Date): Promise<PanelItem[]> {
  const rows = check(
    await db
      .from("stories")
      .select("id, slug, title, global_score")
      .eq("status", "published")
      .eq("category", "ai_tools")
      .gte("first_seen_at", rangeStart("week", now).toISOString())
      .order("global_score", { ascending: false })
      .limit(PANEL_SIZE),
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    value: r.global_score,
  }));
}

/** GitHub rising: stories with a GitHub source, ranked by stars. */
export async function githubPanel(db: Db, now: Date): Promise<PanelItem[]> {
  const rows = check(
    await db
      .from("stories")
      .select(
        "id, slug, title, global_score, story_sources!inner(sources!inner(type))",
      )
      .eq("status", "published")
      .eq("story_sources.sources.type", "github")
      .gte("first_seen_at", rangeStart("week", now).toISOString())
      .order("global_score", { ascending: false })
      .limit(50),
  );
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  const signals = unique.length
    ? check(
        await db.rpc("discover_story_signals", {
          p_story_ids: unique.map((r) => r.id),
        }),
      )
    : [];
  const stars = new Map(signals.map((s) => [s.story_id, s.github_stars ?? 0]));
  return unique
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      value: stars.get(r.id) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, PANEL_SIZE);
}
