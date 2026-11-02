import { adminRunEvent } from "@/lib/admin/jobs";
import { inngest } from "@/inngest/client";
import { pipelineDeps } from "@/inngest/deps";
import { refreshHnMetrics } from "@/lib/pipeline/ingest";
import { recordPipelineRun } from "@/lib/pipeline/store";

// Velocity input (plan §5.8): HN points/comments for stories that left the feeds.
// GitHub and Product Hunt items are re-snapshotted on every fetch while still listed.
export const refreshMetrics = inngest.createFunction(
  {
    id: "refresh-metrics",
    triggers: [
      { cron: "*/30 * * * *" },
      { event: adminRunEvent("refresh-metrics") },
    ],
    concurrency: 1,
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const stats = await step.run("refresh-hn", () =>
      refreshHnMetrics(pipelineDeps()),
    );
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "refresh-metrics",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);
