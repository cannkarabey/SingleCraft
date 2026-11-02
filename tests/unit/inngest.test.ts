import { expect, test } from "vitest";
import { functions } from "@/inngest/functions";

test("registers the pipeline functions", () => {
  expect(functions.map((fn) => fn.id()).sort()).toEqual([
    "archive-stories",
    "billing-reconcile",
    "build-stories",
    "check-alerts",
    "cluster-items",
    "fetch-sources",
    "niche-embed",
    "process-items",
    "radar-angle",
    "refresh-metrics",
    "score-stories",
    "send-digest",
    "studio-generate",
  ]);
});

test("function ids are unique", () => {
  const ids = functions.map((fn) => fn.id());
  expect(new Set(ids).size).toBe(ids.length);
});

test("every admin job listens to its manual-trigger event", async () => {
  const { ADMIN_JOBS, adminRunEvent } = await import("@/lib/admin/jobs");
  for (const job of ADMIN_JOBS) {
    const fn = functions.find((f) => f.id() === job);
    expect(fn, job).toBeDefined();
    const triggers = (
      fn as unknown as { opts: { triggers: { event?: string }[] } }
    ).opts.triggers;
    expect(
      triggers.map((t) => t.event),
      job,
    ).toContain(adminRunEvent(job));
  }
});
