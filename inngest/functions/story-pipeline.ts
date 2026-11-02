import { adminRunEvent } from "@/lib/admin/jobs";
import { inngest } from "@/inngest/client";
import { embedDeps, pipelineDeps, storyBuildDeps } from "@/inngest/deps";
import {
  buildStory,
  clusterItems,
  scoreStories,
  selectBuildCandidates,
} from "@/lib/pipeline/stories";
import { recordPipelineRun } from "@/lib/pipeline/store";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_AFTER_MS = 7 * DAY_MS;
/** trend_scores history kept for sparklines (review I6: unbounded growth). */
const TREND_RETENTION_MS = 14 * DAY_MS;
/** Must match clusterItems' per-run cap: a full batch means more backlog may be waiting. */
const CLUSTER_BATCH = 500;

const onFailure =
  (fn: string) =>
  async ({ error }: { error: Error }) => {
    await recordPipelineRun(pipelineDeps().db, {
      fn,
      startedAt: new Date().toISOString(),
      error: error.message,
    });
  };

// Embedding + semantic clustering (plan §5.3 step 3). Concurrency 1: cluster_item reads
// and updates centroids.
export const clusterItemsFn = inngest.createFunction(
  {
    id: "cluster-items",
    triggers: [{ event: "items/processed" }],
    concurrency: 1,
    onFailure: onFailure("cluster-items"),
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const stats = await step.run("cluster", () => clusterItems(embedDeps()));
    if (stats.embedded >= CLUSTER_BATCH) {
      await step.sendEvent("continue-backlog", {
        name: "items/processed",
        data: {},
      });
    }
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "cluster-items",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);

export const scoreStoriesFn = inngest.createFunction(
  {
    id: "score-stories",
    triggers: [
      { cron: "*/30 * * * *" },
      { event: adminRunEvent("score-stories") },
    ],
    concurrency: 1,
    onFailure: onFailure("score-stories"),
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const stats = await step.run("score", () => scoreStories(pipelineDeps()));
    await step.sendEvent("scored", { name: "stories/scored", data: stats });
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "score-stories",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);

// LLM story builder (plan §5.7): one step per story (plan §2), so a retry never repeats
// calls for stories already built; pacing, cap and budget are enforced inside.
export const buildStoriesFn = inngest.createFunction(
  {
    id: "build-stories",
    triggers: [
      { event: "stories/scored" },
      { event: adminRunEvent("build-stories") },
    ],
    concurrency: 1,
    onFailure: onFailure("build-stories"),
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const { candidates, skipped } = await step.run("candidates", () =>
      selectBuildCandidates(storyBuildDeps()),
    );
    const stats = { built: 0, failed: 0, skipped };
    for (const [index, story] of candidates.entries()) {
      const outcome = await step.run(`build-${story.id}`, () =>
        buildStory(story, storyBuildDeps()),
      );
      if (outcome === "stopped") {
        stats.skipped += candidates.length - index;
        break;
      }
      stats[outcome === "skipped" ? "skipped" : outcome]++;
    }
    if (stats.built > 0) {
      await step.sendEvent("built", { name: "stories/built", data: stats });
    }
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "build-stories",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);

export const archiveStoriesFn = inngest.createFunction(
  {
    id: "archive-stories",
    triggers: [
      { cron: "0 3 * * *" },
      { event: adminRunEvent("archive-stories") },
    ],
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const archived = await step.run("archive", async () => {
      const { db, now } = pipelineDeps();
      const { data, error } = await db.rpc("archive_stale_stories", {
        p_cutoff: new Date(now.getTime() - ARCHIVE_AFTER_MS).toISOString(),
      });
      if (error) throw new Error(error.message);
      return data;
    });
    const pruned = await step.run("prune-trend-scores", async () => {
      const { db, now } = pipelineDeps();
      const { data, error } = await db.rpc("prune_trend_scores", {
        p_before: new Date(now.getTime() - TREND_RETENTION_MS).toISOString(),
      });
      if (error) throw new Error(error.message);
      return data;
    });
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "archive-stories",
        startedAt,
        stats: { archived, pruned },
      }),
    );
    return { archived, pruned };
  },
);
