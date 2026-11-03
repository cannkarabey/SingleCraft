import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { BudgetExceededError } from "@/lib/llm/budget";
import { generateAngle } from "@/lib/radar/angle";
import { runPack } from "@/lib/studio/generate";
import { ShortPack } from "@/lib/studio/schema";
import { db } from "./helpers";

// Guests can create unlimited accounts, so the daily LLM budget must stop Studio and
// Radar angle calls too, not only the story pipeline.
const MODEL_ID = `test:budget-${randomUUID().slice(0, 6)}`;

beforeAll(async () => {
  await db
    .from("llm_usage")
    .insert({ job: "budget-guard-test", model: MODEL_ID, cost_usd: 5 });
});
afterAll(async () => {
  await db.from("llm_usage").delete().eq("model", MODEL_ID);
});

const neverCalled = () => {
  const doGenerate = vi.fn(async () => {
    throw new Error("the model must not be called once the budget is spent");
  });
  return { model: { doGenerate } as never, id: MODEL_ID, doGenerate };
};

describe("daily LLM budget", () => {
  test("Studio packs stop when today's spend has reached the budget", async () => {
    const llm = neverCalled();
    await expect(
      runPack(
        { db, llm: { model: llm.model, id: llm.id }, budgetUsd: 1 },
        ShortPack,
        "system",
        "prompt",
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(llm.doGenerate).not.toHaveBeenCalled();
  });

  test("Radar angles stop when today's spend has reached the budget", async () => {
    const llm = neverCalled();
    await expect(
      generateAngle(
        { db, llm: { model: llm.model, id: llm.id }, budgetUsd: 1 },
        { userId: randomUUID(), nicheId: randomUUID(), storyId: randomUUID() },
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(llm.doGenerate).not.toHaveBeenCalled();
  });
});
