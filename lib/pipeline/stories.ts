import { generateText, Output, type LanguageModel } from "ai";
import {
  assertBudget,
  BudgetExceededError,
  recordUsage,
  todayCallCount,
} from "@/lib/llm/budget";
import {
  STORY_SYSTEM,
  StorySchema,
  storyPrompt,
  type StoryOutput,
  type StorySourceInput,
} from "@/lib/llm/prompts/story";
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

const MAX_SOURCES_PER_PROMPT = 6;
const EXCERPT_CHARS = 800;
/** A published story is rebuilt once this many new sources have joined (plan §5.7). */
const REBUILD_AFTER_NEW_SOURCES = 3;
const LLM_TIMEOUT_MS = 30_000;
const STORY_JOB = "story";

export type BuildDeps = {
  db: Db;
  llm: { model: LanguageModel; id: string };
  now: Date;
  topN: number;
  dailyLimit: number;
  budgetUsd: number;
};

export type BuildResult = { built: number; skipped: number; failed: number };

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function buildCandidates(deps: BuildDeps) {
  const since = new Date(deps.now.getTime() - SCORE_WINDOW_MS).toISOString();
  const pending = check(
    await deps.db
      .from("stories")
      .select("id, slug, source_count, built_source_count, global_score")
      .eq("status", "pending")
      .order("global_score", { ascending: false })
      .limit(deps.topN),
  );
  // PostgREST cannot compare two columns, so the rebuild rule is applied here.
  const published = await allPages((from, to) =>
    deps.db
      .from("stories")
      .select("id, slug, source_count, built_source_count, global_score")
      .eq("status", "published")
      .gte("first_seen_at", since)
      .order("id")
      .range(from, to),
  );
  return [
    ...pending,
    ...published.filter(
      (s) => s.source_count - s.built_source_count >= REBUILD_AFTER_NEW_SOURCES,
    ),
  ]
    .sort((a, b) => b.global_score - a.global_score)
    .slice(0, deps.topN);
}

async function storySources(
  db: Db,
  storyId: string,
): Promise<StorySourceInput[]> {
  const rows = check(
    await db
      .from("story_sources")
      .select(
        "raw_item_id, raw_items(title, description, content_text, url, published_at), sources(name, type)",
      )
      .eq("story_id", storyId)
      .order("raw_item_id")
      .limit(MAX_SOURCES_PER_PROMPT),
  );
  const ids = rows.map((r) => r.raw_item_id);
  const metrics = ids.length
    ? check(
        await db
          .from("item_metrics")
          .select("raw_item_id, metric, value, captured_at")
          .in("raw_item_id", ids)
          .order("captured_at", { ascending: false }),
      )
    : [];
  return rows.flatMap((row) => {
    const item = row.raw_items;
    const source = row.sources;
    if (!item || !source) return [];
    const signals: Record<string, number> = {};
    for (const m of metrics) {
      if (m.raw_item_id === row.raw_item_id && !(m.metric in signals))
        signals[m.metric] = m.value;
    }
    return [
      {
        sourceName: source.name,
        sourceType: source.type,
        title: item.title,
        description: item.description,
        excerpt: (item.content_text ?? "").slice(0, EXCERPT_CHARS),
        url: item.url,
        publishedAt: item.published_at,
        signals,
      },
    ];
  });
}

/** Up to two attempts (the second covers a malformed structured output). */
async function generateStory(
  deps: BuildDeps,
  prompt: string,
): Promise<StoryOutput> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output, usage } = await generateText({
        model: deps.llm.model,
        output: Output.object({ schema: StorySchema }),
        system: STORY_SYSTEM,
        prompt,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
      await recordUsage(deps.db, {
        job: STORY_JOB,
        model: deps.llm.id,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      return output;
    } catch (error) {
      // Count the attempt against the daily cap even when no usage came back.
      await recordUsage(deps.db, { job: STORY_JOB, model: deps.llm.id });
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * LLM story builder (plan §5.7): the top-N pending stories by global_score, plus published
 * stories that gained ≥3 sources since their last build. Stops at the daily call limit or
 * when the budget is spent; a failing story stays pending and the run continues.
 */
export async function buildStories(deps: BuildDeps): Promise<BuildResult> {
  const result: BuildResult = { built: 0, skipped: 0, failed: 0 };
  const candidates = await buildCandidates(deps);

  for (const [index, story] of candidates.entries()) {
    const overLimit =
      (await todayCallCount(deps.db, STORY_JOB)) >= deps.dailyLimit;
    const overBudget = await assertBudget(deps.db, deps.budgetUsd).then(
      () => false,
      (error) => {
        if (error instanceof BudgetExceededError) return true;
        throw error;
      },
    );
    if (overLimit || overBudget) {
      result.skipped += candidates.length - index;
      break;
    }

    const sources = await storySources(deps.db, story.id);
    if (sources.length === 0) {
      result.skipped++;
      continue;
    }

    let output: StoryOutput;
    try {
      output = await generateStory(deps, storyPrompt(sources));
    } catch {
      result.failed++;
      continue;
    }

    check(
      await deps.db
        .from("stories")
        .update({
          title: output.title,
          summary: output.summary,
          why_it_matters: output.why_it_matters,
          category: output.category,
          entities: output.entities,
          sentiment: output.sentiment,
          creator_relevance: output.content_creator_relevance,
          suggested_angles: output.suggested_angles,
          status: "published",
          // Keep an existing slug so published URLs never change.
          slug:
            story.slug ??
            `${slugify(output.title) || "story"}-${story.id.slice(0, 8)}`,
          last_built_at: deps.now.toISOString(),
          built_source_count: story.source_count,
        })
        .eq("id", story.id),
    );
    result.built++;
  }
  return result;
}
