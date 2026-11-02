import { inngest } from "@/inngest/client";
import { pipelineDeps } from "@/inngest/deps";
import { ingestSource } from "@/lib/pipeline/ingest";
import { dueSourceIds, recordPipelineRun } from "@/lib/pipeline/store";

// One cron for all sources; each source's own fetch_interval_min decides whether it is
// due, and each due source is its own step so a retry only re-fetches that source.
export const fetchSources = inngest.createFunction(
  {
    id: "fetch-sources",
    triggers: [{ cron: "*/15 * * * *" }],
    concurrency: 1,
    onFailure: async ({ error }) => {
      await recordPipelineRun(pipelineDeps().db, {
        fn: "fetch-sources",
        startedAt: new Date().toISOString(),
        error: error.message,
      });
    },
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const due = await step.run("due-sources", () =>
      dueSourceIds(pipelineDeps().db),
    );

    const results = await Promise.all(
      due.map((id) =>
        step.run(`fetch-${id}`, () => ingestSource(id, pipelineDeps())),
      ),
    );
    const inserted = results.flatMap((result) => result.inserted);
    if (inserted.length > 0) {
      await step.sendEvent("items-fetched", {
        name: "items/fetched",
        data: { ids: inserted },
      });
    }

    const stats = {
      sources: due.length,
      inserted: inserted.length,
      seen: results.reduce((sum, r) => sum + r.seen, 0),
      invalid: results.reduce((sum, r) => sum + r.invalid, 0),
      failed: results
        .filter((r) => r.error)
        .map((r) => ({ source: r.sourceId, error: r.error! })),
    };
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "fetch-sources",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);
