import { DEDUPE } from "./config";
import { callLlm, llmRetries, type LlmHandle } from "@/lib/llm/call";
import { ModelsBusyError } from "@/lib/llm/fallback";
import { generateText, Output } from "ai";
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
import type { Json } from "@/lib/supabase/types";

const HOUR_MS = 60 * 60 * 1000;
/** Cosine similarity for joining a cluster (plan §5.3); tuned in ./config. */
export const CLUSTER_THRESHOLD = DEDUPE.clusterThreshold;
const CLUSTER_WINDOW_MS = DEDUPE.clusterWindowMs;
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
  /** Cap per run (default MAX_ITEMS_PER_RUN); lets small free-tier quotas be respected. */
  maxItems?: number;
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
      .limit(deps.maxItems ?? MAX_ITEMS_PER_RUN),
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
const SCORE_WRITE_BATCH = 500;

/**
 * Sources that joined a story inside the velocity window, excluding the seed (its earliest
 * item) and the seed's own source: a brand-new single-item story has no new sources.
 */
export function newSourceCount(
  items: { raw_item_id: number; source_id: string; fetched_at: string }[],
  windowStart: Date,
): number {
  if (items.length === 0) return 0;
  const seed = items.reduce((a, b) =>
    a.fetched_at < b.fetched_at ||
    (a.fetched_at === b.fetched_at && a.raw_item_id < b.raw_item_id)
      ? a
      : b,
  );
  const joined = new Set(
    items
      .filter(
        (i) =>
          i.raw_item_id !== seed.raw_item_id &&
          i.source_id !== seed.source_id &&
          new Date(i.fetched_at) >= windowStart,
      )
      .map((i) => i.source_id),
  );
  return joined.size;
}

type StorySource = {
  source_id: string;
  raw_item_id: number;
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
        "id, status, first_seen_at, source_count, story_sources(source_id, raw_item_id, raw_items(fetched_at), sources(type, trust_weight))",
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
    const newSources = newSourceCount(
      sources.flatMap((s) =>
        s.raw_items
          ? [
              {
                raw_item_id: s.raw_item_id,
                source_id: s.source_id,
                fetched_at: s.raw_items.fetched_at,
              },
            ]
          : [],
      ),
      windowStart,
    );
    const ageHours =
      (deps.now.getTime() - new Date(story.first_seen_at).getTime()) / HOUR_MS;

    return {
      id: story.id,
      published: story.status === "published",
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

  const rows = computed.map((c, i) => ({
    id: c.id,
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
  }));
  for (let i = 0; i < rows.length; i += SCORE_WRITE_BATCH) {
    check(
      await deps.db.rpc("apply_story_scores", {
        p_scores: rows.slice(i, i + SCORE_WRITE_BATCH) as unknown as Json,
      }),
    );
  }

  // Sparkline history only for stories readers can see; pending ones would only grow the table.
  for (const [i, row] of rows.entries()) {
    if (!computed[i].published) continue;
    snapshots.push(
      {
        story_id: row.id,
        metric: "global",
        value: row.global_score,
        calculated_at: calculatedAt,
      },
      {
        story_id: row.id,
        metric: "velocity",
        value: row.velocity_score,
        calculated_at: calculatedAt,
      },
      {
        story_id: row.id,
        metric: "engagement",
        value: row.engagement_score,
        calculated_at: calculatedAt,
      },
    );
  }
  for (let i = 0; i < snapshots.length; i += SCORE_WRITE_BATCH) {
    check(
      await deps.db
        .from("trend_scores")
        .insert(snapshots.slice(i, i + SCORE_WRITE_BATCH)),
    );
  }
  return { scored: computed.length };
}

const MAX_SOURCES_PER_PROMPT = 6;
const MAX_CANDIDATE_SOURCES = 50;
const EXCERPT_CHARS = 800;
/** A published story is rebuilt once this many new sources have joined (plan §5.7). */
const REBUILD_AFTER_NEW_SOURCES = 3;
const LLM_TIMEOUT_MS = 30_000;
const STORY_JOB = "story";

export type BuildDeps = {
  db: Db;
  llm: LlmHandle;
  now: Date;
  topN: number;
  dailyLimit: number;
  budgetUsd: number;
  /** Minutes between scheduled build runs; used to pace the daily cap. */
  intervalMinutes?: number;
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
      .select(
        "id, slug, status, source_count, built_source_count, build_failures, global_score",
      )
      .eq("status", "pending")
      .order("global_score", { ascending: false })
      .limit(deps.topN),
  );
  // PostgREST cannot compare two columns, so the rebuild rule is applied here.
  const published = await allPages((from, to) =>
    deps.db
      .from("stories")
      .select(
        "id, slug, status, source_count, built_source_count, build_failures, global_score",
      )
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
  const all = check(
    await db
      .from("story_sources")
      .select(
        "raw_item_id, source_id, raw_items(title, description, content_text, url, published_at), sources(name, type)",
      )
      .eq("story_id", storyId)
      .order("raw_item_id", { ascending: false })
      .limit(MAX_CANDIDATE_SOURCES),
  );
  // Newest first, one item per source before repeats, so rebuilds see the new sources.
  const seen = new Set<string>();
  const firstPerSource = all.filter(
    (r) => !seen.has(r.source_id) && seen.add(r.source_id),
  );
  const rows = [
    ...firstPerSource,
    ...all.filter((r) => !firstPerSource.includes(r)),
  ].slice(0, MAX_SOURCES_PER_PROMPT);
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
      const { value, modelId } = await callLlm(deps, (model) =>
        generateText({
          model,
          output: Output.object({ schema: StorySchema }),
          system: STORY_SYSTEM,
          prompt,
          maxRetries: llmRetries(deps.llm),
          abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        }),
      );
      await recordUsage(deps.db, {
        job: STORY_JOB,
        model: modelId,
        inputTokens: value.usage.inputTokens,
        outputTokens: value.usage.outputTokens,
      });
      return value.output;
    } catch (error) {
      // Nothing was called: not an attempt, and not this story's fault.
      if (error instanceof ModelsBusyError) throw error;
      // Count the attempt against the daily cap even when no usage came back.
      await recordUsage(deps.db, { job: STORY_JOB, model: deps.llm.id });
      lastError = error;
    }
  }
  throw lastError;
}

/** Stories whose build failed this often stop being retried (spec §6.1: retry once, then failed). */
const MAX_BUILD_FAILURES = 2;
const DEFAULT_RUN_INTERVAL_MINUTES = 30;
const DAY_MS = 24 * HOUR_MS;

/**
 * Story builds allowed in this run: the calls left today spread evenly over the runs left
 * before 00:00 UTC, so the cap is not spent by the first runs after midnight.
 */
export function pacedBuildLimit(p: {
  remaining: number;
  now: Date;
  intervalMinutes: number;
  topN: number;
}): number {
  if (p.remaining <= 0) return 0;
  const msLeft = DAY_MS - (p.now.getTime() % DAY_MS);
  const runsLeft = Math.max(
    1,
    Math.ceil(msLeft / (p.intervalMinutes * 60_000)),
  );
  return Math.min(p.topN, p.remaining, Math.ceil(p.remaining / runsLeft));
}

export type BuildCandidate = Awaited<
  ReturnType<typeof buildCandidates>
>[number];

/** Candidates for this run, already cut to the paced limit; the rest count as skipped. */
export async function selectBuildCandidates(
  deps: BuildDeps,
): Promise<{ candidates: BuildCandidate[]; skipped: number }> {
  const all = await buildCandidates(deps);
  const used = await todayCallCount(deps.db, STORY_JOB);
  const limit = pacedBuildLimit({
    remaining: deps.dailyLimit - used,
    now: deps.now,
    intervalMinutes: deps.intervalMinutes ?? DEFAULT_RUN_INTERVAL_MINUTES,
    topN: deps.topN,
  });
  return {
    candidates: all.slice(0, limit),
    skipped: Math.max(0, all.length - limit),
  };
}

export type BuildOutcome = "built" | "failed" | "skipped" | "stopped";

/** Builds one story; "stopped" means the daily cap or budget is reached. */
export async function buildStory(
  story: BuildCandidate,
  deps: BuildDeps,
): Promise<BuildOutcome> {
  if ((await todayCallCount(deps.db, STORY_JOB)) >= deps.dailyLimit)
    return "stopped";
  try {
    await assertBudget(deps.db, deps.budgetUsd);
  } catch (error) {
    if (error instanceof BudgetExceededError) return "stopped";
    throw error;
  }

  const sources = await storySources(deps.db, story.id);
  if (sources.length === 0) return "skipped";

  let output: StoryOutput;
  try {
    output = await generateStory(deps, storyPrompt(sources));
  } catch (error) {
    // Every model is resting: like an exhausted budget, stop and let the next run retry.
    if (error instanceof ModelsBusyError) return "stopped";
    const failures = story.build_failures + 1;
    const patch =
      story.status === "published"
        ? // Keep the published brief; wait for more sources before trying again.
          { build_failures: failures, built_source_count: story.source_count }
        : {
            build_failures: failures,
            ...(failures >= MAX_BUILD_FAILURES
              ? { status: "suppressed" as const }
              : {}),
          };
    check(await deps.db.from("stories").update(patch).eq("id", story.id));
    return "failed";
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
        build_failures: 0,
      })
      .eq("id", story.id)
      // Never resurrect a story archived or suppressed meanwhile.
      .in("status", ["pending", "published"]),
  );
  return "built";
}

/**
 * LLM story builder (plan §5.7): the top pending stories by global_score plus published
 * stories that gained ≥3 sources, paced across the UTC day and stopped by the daily call
 * cap or budget. Inngest runs each story as its own step; this loop serves scripts/tests.
 */
export async function buildStories(deps: BuildDeps): Promise<BuildResult> {
  const { candidates, skipped } = await selectBuildCandidates(deps);
  const result: BuildResult = { built: 0, skipped, failed: 0 };
  for (const [index, story] of candidates.entries()) {
    const outcome = await buildStory(story, deps);
    if (outcome === "stopped") {
      result.skipped += candidates.length - index;
      break;
    }
    result[outcome]++;
  }
  return result;
}
