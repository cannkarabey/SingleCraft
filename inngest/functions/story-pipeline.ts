import { inngest } from "@/inngest/client";
import { embedDeps, pipelineDeps, storyBuildDeps } from "@/inngest/deps";
import {
  buildStories,
  clusterItems,
  scoreStories,
} from "@/lib/pipeline/stories";
import { recordPipelineRun } from "@/lib/pipeline/store";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_AFTER_MS = 7 * DAY_MS;
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
    triggers: [{ cron: "*/30 * * * *" }],
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

// LLM story builder (plan §5.7): top-N, daily call cap and budget enforced inside.
export const buildStoriesFn = inngest.createFunction(
  {
    id: "build-stories",
    triggers: [{ event: "stories/scored" }],
    concurrency: 1,
    onFailure: onFailure("build-stories"),
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const stats = await step.run("build", () => buildStories(storyBuildDeps()));
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
  { id: "archive-stories", triggers: [{ cron: "0 3 * * *" }] },
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
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "archive-stories",
        startedAt,
        stats: { archived },
      }),
    );
    return { archived };
  },
);
