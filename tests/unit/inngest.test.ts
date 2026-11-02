import { expect, test } from "vitest";
import { functions } from "@/inngest/functions";

test("registers the ingestion functions", () => {
  expect(functions.map((fn) => fn.id()).sort()).toEqual([
    "fetch-sources",
    "process-items",
    "refresh-metrics",
  ]);
});

test("function ids are unique", () => {
  const ids = functions.map((fn) => fn.id());
  expect(new Set(ids).size).toBe(ids.length);
});
