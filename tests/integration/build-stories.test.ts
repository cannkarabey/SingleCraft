import { afterAll, describe, expect, test } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { buildStories } from "@/lib/pipeline/stories";
import { todayCallCount, todaySpendUsd } from "@/lib/llm/budget";
import { cleanup, db, makeItem, makeSource } from "./helpers";

const created: string[] = [];
const MODEL_ID = "test:mock-story";
afterAll(async () => {
  await db.from("llm_usage").delete().eq("model", MODEL_ID);
  await cleanup(created);
});

const validOutput = {
  title: "OpenAI ships Agent SDK 2.0",
  summary:
    "OpenAI released version 2.0 of its Agent SDK. It adds tracing and tool use.",
  why_it_matters: "Agent builders get production tooling out of the box.",
  category: "ai_tools",
  entities: ["OpenAI", "Agent SDK"],
  sentiment: "positive",
  content_creator_relevance: 82,
  suggested_angles: [
    "Hands-on review",
    "Migration guide",
    "Comparison with LangGraph",
  ],
};

function mockModel(text: string | (() => string), prompts: string[] = []) {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      return {
        content: [
          { type: "text", text: typeof text === "function" ? text() : text },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1200,
            noCache: 1200,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 300, text: 300, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

/** A pending story ranked above everything else in the local DB. */
async function makeStory(
  sourceIds: string[],
  fields: Record<string, unknown> = {},
) {
  const { data: story } = await db
    .from("stories")
    .insert({
      status: "pending",
      global_score: 10_000,
      source_count: sourceIds.length,
      ...fields,
    })
    .select("id")
    .single();
  for (const [i, sourceId] of sourceIds.entries()) {
    const item = await makeItem(
      sourceId,
      `Source ${i} reports the Agent SDK launch`,
      {
        description: `Description ${i}`,
        content_text: "x".repeat(2000),
      },
    );
    await db
      .from("story_sources")
      .insert({ story_id: story!.id, raw_item_id: item, source_id: sourceId });
  }
  return story!.id;
}

const baseDeps = async (model: MockLanguageModelV4, overrides = {}) => ({
  db,
  llm: { model, id: MODEL_ID },
  now: new Date(),
  topN: 1,
  dailyLimit: (await todayCallCount(db, "story")) + 100,
  budgetUsd: (await todaySpendUsd(db)) + 100,
  ...overrides,
});

describe("buildStories", () => {
  test("publishes the top pending story with LLM fields, slug and usage", async () => {
    const s = await makeSource(created);
    const story = await makeStory([s, s, s, s, s, s, s, s]);
    const prompts: string[] = [];

    const result = await buildStories(
      await baseDeps(mockModel(JSON.stringify(validOutput), prompts)),
    );
    expect(result).toMatchObject({ built: 1, failed: 0 });

    const { data } = await db
      .from("stories")
      .select("*")
      .eq("id", story)
      .single();
    expect(data).toMatchObject({
      status: "published",
      title: validOutput.title,
      summary: validOutput.summary,
      why_it_matters: validOutput.why_it_matters,
      category: "ai_tools",
      entities: validOutput.entities,
      sentiment: "positive",
      creator_relevance: 82,
      suggested_angles: validOutput.suggested_angles,
      built_source_count: 8,
    });
    expect(data!.slug).toMatch(/^openai-ships-agent-sdk-2-0-[0-9a-f]{8}$/);
    expect(data!.last_built_at).not.toBeNull();

    // At most 6 sources, newest first (review I3), 800 chars of content each.
    expect(prompts[0]).toContain("Source 7 reports");
    expect(prompts[0]).toContain("Source 2 reports");
    expect(prompts[0]).not.toContain("Source 1 reports");
    expect(prompts[0]).not.toContain("x".repeat(801));

    const { count } = await db
      .from("llm_usage")
      .select("*", { count: "exact", head: true })
      .eq("model", MODEL_ID)
      .eq("job", "story");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("rebuilds a published story only after 3 new sources", async () => {
    const s = await makeSource(created);
    const fresh = await makeStory([s, s], {
      status: "published",
      built_source_count: 1,
      title: "old",
      slug: `keep-${Date.now()}`,
    });
    const result = await buildStories(
      await baseDeps(mockModel(JSON.stringify(validOutput)), { topN: 5 }),
    );
    const { data } = await db
      .from("stories")
      .select("title, slug")
      .eq("id", fresh)
      .single();
    expect(data!.title).toBe("old");
    expect(result.built).toBeGreaterThanOrEqual(0);

    await db.from("stories").update({ source_count: 4 }).eq("id", fresh);
    await buildStories(
      await baseDeps(mockModel(JSON.stringify(validOutput)), { topN: 5 }),
    );
    const { data: rebuilt } = await db
      .from("stories")
      .select("title, slug, built_source_count")
      .eq("id", fresh)
      .single();
    expect(rebuilt).toMatchObject({
      title: validOutput.title,
      built_source_count: 4,
    });
    expect(rebuilt!.slug).toMatch(/^keep-/); // published URLs stay stable
  });

  test("stops at the daily call limit", async () => {
    const s = await makeSource(created);
    await makeStory([s]);
    await makeStory([s]);
    const used = await todayCallCount(db, "story");
    const result = await buildStories(
      await baseDeps(mockModel(JSON.stringify(validOutput)), {
        topN: 2,
        dailyLimit: used + 1,
      }),
    );
    expect(result.built).toBe(1);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  test("stops when the budget is spent", async () => {
    const s = await makeSource(created);
    await makeStory([s]);
    const result = await buildStories(
      await baseDeps(mockModel(JSON.stringify(validOutput)), {
        budgetUsd: await todaySpendUsd(db),
      }),
    );
    expect(result.built).toBe(0);
  });

  test("invalid model output leaves the story pending and continues", async () => {
    const s = await makeSource(created);
    const bad = await makeStory([s], { global_score: 20_000 });
    const good = await makeStory([s], { global_score: 19_000 });
    let call = 0;
    // First story: both attempts return garbage; second story: valid.
    const model = mockModel(() =>
      ++call <= 2 ? "not json" : JSON.stringify(validOutput),
    );
    const result = await buildStories(await baseDeps(model, { topN: 2 }));
    expect(result).toMatchObject({ built: 1, failed: 1 });
    const { data } = await db
      .from("stories")
      .select("id, status")
      .in("id", [bad, good]);
    const status = Object.fromEntries(data!.map((r) => [r.id, r.status]));
    expect(status[bad]).toBe("pending");
    expect(status[good]).toBe("published");
  });

  test("a story that keeps failing is suppressed after two runs (review I2)", async () => {
    const s = await makeSource(created);
    const stuck = await makeStory([s], { global_score: 30_000 });
    const deps = async () => baseDeps(mockModel("not json"), { topN: 1 });

    await buildStories(await deps());
    const { data: first } = await db
      .from("stories")
      .select("status, build_failures")
      .eq("id", stuck)
      .single();
    expect(first).toEqual({ status: "pending", build_failures: 1 });

    await buildStories(await deps());
    const { data: second } = await db
      .from("stories")
      .select("status, build_failures")
      .eq("id", stuck)
      .single();
    expect(second).toEqual({ status: "suppressed", build_failures: 2 });
  });
});
