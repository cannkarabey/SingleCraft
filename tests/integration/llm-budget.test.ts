import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertBudget,
  BudgetExceededError,
  recordUsage,
  todayCallCount,
  todaySpendUsd,
} from "@/lib/llm/budget";

const db = createAdminClient();
const job = `test-${randomUUID()}`;

afterAll(async () => {
  await db.from("llm_usage").delete().like("job", "test-%");
});

describe("llm budget", () => {
  test("recordUsage stores tokens and estimated cost", async () => {
    await recordUsage(db, {
      job,
      model: "google:x",
      inputTokens: 1000,
      outputTokens: 500,
    });
    const { data } = await db
      .from("llm_usage")
      .select("*")
      .eq("job", job)
      .single();
    expect(data).toMatchObject({
      model: "google:x",
      tokens_in: 1000,
      tokens_out: 500,
    });
    expect(Number(data!.cost_usd)).toBeGreaterThan(0);
  });

  test("counts only today's calls for the job", async () => {
    await recordUsage(db, {
      job,
      model: "google:x",
      inputTokens: 1,
      outputTokens: 1,
    });
    await db.from("llm_usage").insert({
      job,
      model: "google:x",
      cost_usd: 0,
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    expect(await todayCallCount(db, job)).toBe(2);
  });

  test("blocks once today's spend reaches the budget", async () => {
    const before = await todaySpendUsd(db);
    await expect(assertBudget(db, before + 1)).resolves.toBeUndefined();
    await db.from("llm_usage").insert({ job, model: "google:x", cost_usd: 1 });
    await expect(assertBudget(db, before + 1)).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });
});
