import type { Db } from "@/lib/pipeline/store";
import { estimateCostUsd } from "./provider";

export class BudgetExceededError extends Error {
  constructor(spentUsd: number, budgetUsd: number) {
    super(`Daily LLM budget reached: $${spentUsd.toFixed(4)} of $${budgetUsd}`);
  }
}

/** Start of the current UTC day; budgets and call caps reset at 00:00 UTC. */
function startOfTodayUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function recordUsage(
  db: Db,
  usage: {
    job: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
  },
): Promise<void> {
  const { error } = await db.from("llm_usage").insert({
    job: usage.job,
    model: usage.model,
    tokens_in: usage.inputTokens ?? null,
    tokens_out: usage.outputTokens ?? null,
    cost_usd: estimateCostUsd(usage),
  });
  fail(error);
}

export async function todaySpendUsd(db: Db): Promise<number> {
  const { data, error } = await db
    .from("llm_usage")
    .select("cost_usd")
    .gte("created_at", startOfTodayUtc());
  fail(error);
  // cost_usd is numeric(10,5): sum in integer 1e-5 units so the total does not depend on
  // row order (floating-point addition is not associative).
  const units = (data ?? []).reduce(
    (sum, row) => sum + Math.round(Number(row.cost_usd ?? 0) * 1e5),
    0,
  );
  return units / 1e5;
}

export async function todayCallCount(db: Db, job: string): Promise<number> {
  const { count, error } = await db
    .from("llm_usage")
    .select("*", { count: "exact", head: true })
    .eq("job", job)
    .gte("created_at", startOfTodayUtc());
  fail(error);
  return count ?? 0;
}

/** Throws BudgetExceededError when today's estimated spend has reached the budget. */
export async function assertBudget(db: Db, budgetUsd: number): Promise<void> {
  const spent = await todaySpendUsd(db);
  if (spent >= budgetUsd) throw new BudgetExceededError(spent, budgetUsd);
}
