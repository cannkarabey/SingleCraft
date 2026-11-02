import { inngest } from "@/inngest/client";
import { pipelineDeps } from "@/inngest/deps";
import { processItems, type ProcessResult } from "@/lib/pipeline/ingest";
import { recordPipelineRun } from "@/lib/pipeline/store";

const CHUNK_SIZE = 50;

// Concurrency 1: dedupe compares against already-accepted items, so two runs in
// parallel could each accept one half of a duplicate pair.
export const processItemsFn = inngest.createFunction(
  {
    id: "process-items",
    triggers: [{ event: "items/fetched" }],
    concurrency: 1,
    onFailure: async ({ error }) => {
      await recordPipelineRun(pipelineDeps().db, {
        fn: "process-items",
        startedAt: new Date().toISOString(),
        error: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const ids = ((event.data as { ids?: number[] }).ids ?? [])
      .slice()
      .sort((a, b) => a - b);

    const totals: ProcessResult = { accepted: 0, rejected: 0, duplicate: 0 };
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const result = await step.run(`process-${i / CHUNK_SIZE}`, () =>
        processItems(chunk, pipelineDeps()),
      );
      totals.accepted += result.accepted;
      totals.rejected += result.rejected;
      totals.duplicate += result.duplicate;
    }

    // Accepted items need embedding/clustering; duplicates may join existing stories.
    if (totals.accepted + totals.duplicate > 0) {
      await step.sendEvent("items-processed", {
        name: "items/processed",
        data: totals,
      });
    }

    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "process-items",
        startedAt,
        stats: totals,
      }),
    );
    return totals;
  },
);
