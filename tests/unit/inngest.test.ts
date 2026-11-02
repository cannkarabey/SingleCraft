import { expect, test } from "vitest";
import { functions } from "@/inngest/functions";

test("registers the pipeline functions", () => {
  expect(functions.map((fn) => fn.id()).sort()).toEqual([
    "archive-stories",
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
