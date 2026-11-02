// One ingestion pass outside Inngest, using the same orchestrators:
// fetch every due source → dedupe + filter pending items → refresh HN metrics.
//   npm run ingest:once
import { pipelineDeps } from "@/inngest/deps";
import {
  ingestSource,
  processItems,
  refreshHnMetrics,
} from "@/lib/pipeline/ingest";
import { allPendingItemIds, dueSourceIds } from "@/lib/pipeline/store";

const PARALLEL_FETCHES = 6;

async function main() {
  const due = await dueSourceIds(pipelineDeps().db);
  console.log(`due sources: ${due.length}`);

  const results = [];
  for (let i = 0; i < due.length; i += PARALLEL_FETCHES) {
    const batch = due.slice(i, i + PARALLEL_FETCHES);
    results.push(
      ...(await Promise.all(
        batch.map((id) => ingestSource(id, pipelineDeps())),
      )),
    );
  }

  for (const failed of results.filter((r) => r.error)) {
    console.log(`  failed ${failed.sourceId}: ${failed.error}`);
  }
  const inserted = results.flatMap((r) => r.inserted).sort((a, b) => a - b);
  console.log(`inserted: ${inserted.length}`);

  // Everything pending, not just this run's inserts, so an interrupted run catches up.
  const pending = await allPendingItemIds(pipelineDeps().db);
  console.log(`pending: ${pending.length}`);
  const processed = await processItems(pending, pipelineDeps());
  console.log("processed:", processed);

  const metrics = await refreshHnMetrics(pipelineDeps());
  console.log("hn metrics:", metrics);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
