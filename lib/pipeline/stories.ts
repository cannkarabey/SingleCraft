import {
  engagementScore,
  freshnessScore,
  globalScore,
  isEarlySignal,
  percentileRanks,
  sourceDiversityScore,
  trustScore,
  velocityRaw,
} from "./score";
import { allPages, type Db } from "./store";
import type { SourceType } from "./types";

const HOUR_MS = 60 * 60 * 1000;
/** Cosine similarity for joining a cluster, and how far back clusters stay open (plan §5.3). */
export const CLUSTER_THRESHOLD = 0.85;
const CLUSTER_WINDOW_MS = 72 * HOUR_MS;
/** Items embedded per run; bounds embedding quota use. Newest items first. */
const MAX_ITEMS_PER_RUN = 500;
const EMBED_TEXT_CHARS = 1000;

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

function check<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

const toVector = (values: number[]) => `[${values.join(",")}]`;

export type ClusterResult = {
  embedded: number;
  created: number;
  joined: number;
  duplicatesAttached: number;
};

/**
 * Embeds accepted items that are not in a story yet and clusters them (plan §5.3 step 3),
 * then attaches Faz 2 duplicates to their root's story. Must run with concurrency 1.
 */
export async function clusterItems(deps: {
  db: Db;
  embed: EmbedFn;
  now: Date;
}): Promise<ClusterResult> {
  const result: ClusterResult = {
    embedded: 0,
    created: 0,
    joined: 0,
    duplicatesAttached: 0,
  };

  const items = check(
    await deps.db
      .from("raw_items")
      .select("id, title, description, story_sources!left(id)")
      .eq("filter_status", "accepted")
      .is("story_sources", null)
      .order("id", { ascending: false })
      .limit(MAX_ITEMS_PER_RUN),
  );

  if (items.length > 0) {
    const vectors = await deps.embed(
      items.map((item) =>
        `${item.title}\n${item.description ?? ""}`.slice(0, EMBED_TEXT_CHARS),
      ),
    );
    result.embedded = vectors.length;
    const since = new Date(
      deps.now.getTime() - CLUSTER_WINDOW_MS,
    ).toISOString();

    // Oldest first, so an event's earliest report seeds its cluster.
    for (let i = items.length - 1; i >= 0; i--) {
      const [row] = check(
        await deps.db.rpc("cluster_item", {
          p_item_id: items[i].id,
          p_embedding: toVector(vectors[i]),
          p_threshold: CLUSTER_THRESHOLD,
          p_since: since,
        }),
      );
      if (row.created) result.created++;
      else result.joined++;
    }
  }

  result.duplicatesAttached = check(await deps.db.rpc("attach_duplicates"));
  return result;
}

/** Velocity looks at growth over this trailing window (plan §5.5). */
const VELOCITY_WINDOW_MS = 6 * HOUR_MS;
const SCORE_WINDOW_MS = 72 * HOUR_MS;

type StorySource = {
  source_id: string;
  raw_items: { fetched_at: string } | null;
  sources: { type: SourceType; trust_weight: number } | null;
};

/**
 * Recomputes sub-scores, global_score and the early-signal flag for every live story first
 * seen in the last 72 h, and snapshots global/velocity/engagement into trend_scores.
 */
export async function scoreStories(deps: {
  db: Db;
  now: Date;
}): Promise<{ scored: number }> {
  const since = new Date(deps.now.getTime() - SCORE_WINDOW_MS).toISOString();
  const windowStart = new Date(deps.now.getTime() - VELOCITY_WINDOW_MS);

  const stories = await allPages((from, to) =>
    deps.db
      .from("stories")
      .select(
        "id, first_seen_at, source_count, story_sources(source_id, raw_items(fetched_at), sources(type, trust_weight))",
      )
      .in("status", ["pending", "published"])
      .gte("first_seen_at", since)
      .order("id")
      .range(from, to),
  );
  if (stories.length === 0) return { scored: 0 };

  const metrics = await allPages((from, to) =>
    deps.db
      .rpc("story_metric_window", {
        p_since: since,
        p_window_start: windowStart.toISOString(),
      })
      .order("story_id")
      .order("raw_item_id")
      .order("metric")
      .range(from, to),
  );
  const metricsByStory = new Map<string, typeof metrics>();
  for (const row of metrics) {
    metricsByStory.set(row.story_id, [
      ...(metricsByStory.get(row.story_id) ?? []),
      row,
    ]);
  }

  const computed = stories.map((story) => {
    const sources = (story.story_sources ?? []) as unknown as StorySource[];
    const storyMetrics = metricsByStory.get(story.id) ?? [];
    const distinct = new Map<string, { type: SourceType; trust: number }>();
    for (const s of sources) {
      if (s.sources)
        distinct.set(s.source_id, {
          type: s.sources.type,
          trust: Number(s.sources.trust_weight),
        });
    }
    const newSources = sources.filter(
      (s) => s.raw_items && new Date(s.raw_items.fetched_at) >= windowStart,
    ).length;
    const ageHours =
      (deps.now.getTime() - new Date(story.first_seen_at).getTime()) / HOUR_MS;

    return {
      id: story.id,
      sourceCount: story.source_count,
      ageHours,
      velocityRaw: velocityRaw(
        storyMetrics.map((m) => ({
          sourceType: m.source_type,
          metric: m.metric,
          latest: m.latest,
          baseline: m.baseline,
        })),
        newSources,
      ),
      engagement: engagementScore(
        storyMetrics.map((m) => ({
          sourceType: m.source_type,
          metric: m.metric,
          value: m.latest,
        })),
      ),
      diversity: sourceDiversityScore(
        distinct.size,
        new Set([...distinct.values()].map((s) => s.type)).size,
      ),
      freshness: freshnessScore(ageHours),
      trust: trustScore([...distinct.values()].map((s) => s.trust)),
    };
  });

  const velocity = percentileRanks(computed.map((c) => c.velocityRaw));
  const calculatedAt = deps.now.toISOString();
  const snapshots: {
    story_id: string;
    metric: string;
    value: number;
    calculated_at: string;
  }[] = [];

  for (const [i, c] of computed.entries()) {
    const scores = {
      velocity_score: velocity[i],
      engagement_score: c.engagement,
      source_diversity_score: c.diversity,
      freshness_score: c.freshness,
      trust_score: c.trust,
      global_score: globalScore({ ...c, velocity: velocity[i] }),
      is_early_signal: isEarlySignal({
        velocityPercentile: velocity[i],
        sourceCount: c.sourceCount,
        engagement: c.engagement,
        ageHours: c.ageHours,
      }),
    };
    check(await deps.db.from("stories").update(scores).eq("id", c.id));
    snapshots.push(
      {
        story_id: c.id,
        metric: "global",
        value: scores.global_score,
        calculated_at: calculatedAt,
      },
      {
        story_id: c.id,
        metric: "velocity",
        value: scores.velocity_score,
        calculated_at: calculatedAt,
      },
      {
        story_id: c.id,
        metric: "engagement",
        value: scores.engagement_score,
        calculated_at: calculatedAt,
      },
    );
  }

  for (let i = 0; i < snapshots.length; i += 500) {
    check(
      await deps.db.from("trend_scores").insert(snapshots.slice(i, i + 500)),
    );
  }
  return { scored: computed.length };
}
