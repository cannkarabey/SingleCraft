import { expect, test } from "vitest";
import { functions } from "@/inngest/functions";

test("registers the pipeline functions", () => {
  expect(functions.map((fn) => fn.id()).sort()).toEqual([
    "archive-stories",
    "build-stories",
    "cluster-items",
    "fetch-sources",
    "process-items",
    "refresh-metrics",
    "score-stories",
  ]);
});

test("function ids are unique", () => {
  const ids = functions.map((fn) => fn.id());
  expect(new Set(ids).size).toBe(ids.length);
});
