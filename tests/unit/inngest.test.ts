import { expect, test } from "vitest";
import { functions } from "@/inngest/functions";

test("registers at least one function", () => {
  expect(functions.length).toBeGreaterThan(0);
});

test("function ids are unique", () => {
  const ids = functions.map((fn) => fn.id());
  expect(new Set(ids).size).toBe(ids.length);
});
