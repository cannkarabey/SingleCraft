import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { dbModelStore } from "@/lib/llm/model-store";
import { usageName } from "@/lib/llm/models";
import { db } from "./helpers";

// Cooldowns must outlive a single serverless invocation: they live in Postgres.
const id = `test-${randomUUID().slice(0, 8)}`;
const store = dbModelStore(db);
const now = new Date();
const later = (ms: number) => new Date(now.getTime() + ms);

afterAll(async () => {
  await db.from("llm_model_state").delete().eq("model", id);
  await db.from("llm_usage").delete().eq("model", usageName(id));
});

describe("dbModelStore", () => {
  test("a rest is visible to the next invocation until it ends", async () => {
    await store.markUnavailable(
      id,
      later(65_000),
      "quota: requests per minute",
    );
    expect((await store.unavailable(now)).get(id)).toEqual(later(65_000));
    expect((await store.unavailable(later(66_000))).has(id)).toBe(false);
  });

  test("a longer rest is never shortened by a later, shorter one", async () => {
    await store.markUnavailable(id, later(3600_000), "quota: requests per day");
    await store.markUnavailable(
      id,
      later(65_000),
      "quota: requests per minute",
    );
    expect((await store.unavailable(now)).get(id)).toEqual(later(3600_000));
  });

  test("calls are counted from llm_usage by model and time", async () => {
    await db.from("llm_usage").insert([
      {
        job: "t",
        model: usageName(id),
        created_at: later(-30_000).toISOString(),
      },
      {
        job: "t",
        model: usageName(id),
        created_at: later(-3600_000).toISOString(),
      },
      { job: "t", model: "google:other", created_at: now.toISOString() },
    ]);
    expect(await store.calls(id, later(-60_000))).toBe(1);
    expect(await store.calls(id, later(-2 * 3600_000))).toBe(2);
  });
});
