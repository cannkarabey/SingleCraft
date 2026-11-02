import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  embedNiche,
  generateAngle,
  getAngle,
  requestAngle,
} from "@/lib/radar/angle";
import { createNiche } from "@/lib/radar/niches";
import { axisVector, db } from "./helpers";
import { makeUser } from "./users";

const cleanups: (() => Promise<unknown>)[] = [];
let storyId: string;

beforeAll(async () => {
  const { data } = await db
    .from("stories")
    .insert({
      status: "published",
      title: "Agents SDK ships",
      summary: "It adds tracing.",
      why_it_matters: "Builders care.",
    })
    .select("id")
    .single();
  storyId = data!.id;
  cleanups.push(async () => db.from("stories").delete().eq("id", storyId));
});
afterAll(async () => {
  await db.from("llm_usage").delete().eq("model", "test:angle");
  for (const c of cleanups.reverse()) await c();
});

async function userWithNiche() {
  const u = await makeUser("free");
  cleanups.push(u.remove);
  const created = await createNiche({
    admin: db,
    userId: u.id,
    input: { name: "AI agents", keywords: ["agents"], language: "en" },
  });
  if (!created.ok) throw new Error("niche");
  return { ...u, nicheId: created.niche.id };
}

const model = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 300,
          noCache: 300,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 60, text: 60, reasoning: undefined },
      },
      warnings: [],
    }),
  });

describe("personal angle", () => {
  test("request queues once, generation caches it, a second request returns it", async () => {
    const u = await userWithNiche();
    const sent: unknown[] = [];
    const send = async (event: unknown) => {
      sent.push(event);
    };

    const first = await requestAngle({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      plan: "free",
      send,
    });
    expect(first).toEqual({ status: "queued" });
    expect(sent).toHaveLength(1);
    expect(await getAngle(u.client, { storyId })).toBeNull();

    await generateAngle(
      {
        db,
        llm: {
          model: model(
            JSON.stringify({ angle: "Show a 5-minute agent with tracing." }),
          ),
          id: "test:angle",
        },
      },
      { userId: u.id, nicheId: u.nicheId, storyId },
    );
    expect(await getAngle(u.client, { storyId })).toBe(
      "Show a 5-minute agent with tracing.",
    );

    const again = await requestAngle({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      plan: "free",
      send,
    });
    expect(again).toEqual({
      status: "ready",
      angle: "Show a 5-minute agent with tracing.",
    });
    expect(sent).toHaveLength(1);
  });

  test("daily limit", async () => {
    const u = await userWithNiche();
    await db
      .from("usage_counters")
      .insert({
        user_id: u.id,
        day: new Date().toISOString().slice(0, 10),
        kind: "personal_angle",
        count: 5,
      });
    const result = await requestAngle({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      plan: "free",
      send: async () => {},
    });
    expect(result).toEqual({ status: "limit" });
  });

  test("failed generation gives the usage back", async () => {
    const u = await userWithNiche();
    await requestAngle({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      plan: "free",
      send: async () => {},
    });
    await expect(
      generateAngle(
        { db, llm: { model: model("not json"), id: "test:angle" } },
        { userId: u.id, nicheId: u.nicheId, storyId },
      ),
    ).rejects.toThrow();
    const { data } = await db
      .from("usage_counters")
      .select("count")
      .eq("user_id", u.id)
      .eq("kind", "personal_angle")
      .single();
    expect(data!.count).toBe(0);
  });
});

test("a failed enqueue gives the usage back", async () => {
  const u = await userWithNiche();
  await expect(
    requestAngle({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      plan: "free",
      send: async () => {
        throw new Error("inngest down");
      },
    }),
  ).rejects.toThrow("inngest down");
  const { data } = await db
    .from("usage_counters")
    .select("count")
    .eq("user_id", u.id)
    .eq("kind", "personal_angle")
    .single();
  expect(data!.count).toBe(0);
});

describe("embedNiche", () => {
  test("stores a 768-dim embedding of name + keywords", async () => {
    const u = await userWithNiche();
    const seen: string[][] = [];
    await embedNiche(
      {
        db,
        embed: async (texts) => (
          seen.push(texts),
          texts.map(() => axisVector(3))
        ),
      },
      u.nicheId,
    );
    expect(seen[0][0]).toContain("AI agents");
    expect(seen[0][0]).toContain("agents");
    const { data } = await db
      .from("niches")
      .select("embedding")
      .eq("id", u.nicheId)
      .single();
    expect(data!.embedding).not.toBeNull();
  });
});
