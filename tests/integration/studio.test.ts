import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  generateBrief,
  requestBrief,
  requestRegenerate,
} from "@/lib/studio/generate";
import { LIMITS } from "@/lib/limits";
import { publishBrief, saveEdits } from "@/lib/studio/briefs";
import { createNiche } from "@/lib/radar/niches";
import { cleanup as cleanupSources, db, makeItem, makeSource } from "./helpers";
import { makeUser } from "./users";

const MODEL_ID = "test:studio";
const created: string[] = [];
const cleanups: (() => Promise<unknown>)[] = [];
let storyId: string;
let pendingStoryId: string;
const sourceRows: { title: string; url: string }[] = [];

const short = {
  hooks: Array.from({ length: 10 }, (_, i) => `Kanca ${i + 1}`),
  titles: ["Başlık A", "Başlık B", "Başlık C"],
  x_thread: ["1/ İlk tweet", "2/ İkinci tweet"],
  linkedin_post: "LinkedIn gönderisi.",
  shorts_hooks: ["Kısa 1", "Kısa 2", "Kısa 3"],
  shorts_script: {
    hook: "Açılış",
    beats: ["Bir", "İki"],
    cta: "Takip et",
    duration_sec: 40,
  },
};
const long = {
  newsletter_section: "Bülten paragrafı.",
  blog_draft: "# Blog\n\nMetin.",
};

/** Mock model that answers the short or long pack depending on the prompt. */
function mockModel(prompts: string[] = [], broken = false) {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      const text = JSON.stringify(options.prompt);
      prompts.push(text);
      const body = broken
        ? "not json"
        : JSON.stringify(text.includes("newsletter section") ? long : short);
      return {
        content: [{ type: "text", text: body }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1000,
            noCache: 1000,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 400, text: 400, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

beforeAll(async () => {
  const s1 = await makeSource(created);
  const s2 = await makeSource(created, "hn");
  const { data: story } = await db
    .from("stories")
    .insert({
      status: "published",
      title: "Agents SDK ships",
      summary: "Tracing built in.",
      why_it_matters: "Builders care.",
    })
    .select("id")
    .single();
  storyId = story!.id;
  for (const [i, source] of [s1, s2].entries()) {
    const id = await makeItem(source, `Source report ${i}`);
    const { data: item } = await db
      .from("raw_items")
      .select("title, url")
      .eq("id", id)
      .single();
    sourceRows.push(item!);
    await db
      .from("story_sources")
      .insert({ story_id: storyId, raw_item_id: id, source_id: source });
  }
  const { data: pending } = await db
    .from("stories")
    .insert({ status: "pending", title: "Not yet" })
    .select("id")
    .single();
  pendingStoryId = pending!.id;
  cleanups.push(async () =>
    db.from("stories").delete().in("id", [storyId, pendingStoryId]),
  );
});

afterAll(async () => {
  await db.from("llm_usage").delete().eq("model", MODEL_ID);
  for (const c of cleanups.reverse()) await c();
  await cleanupSources(created);
});

async function user() {
  const u = await makeUser();
  cleanups.push(u.remove);
  const niche = await createNiche({
    admin: db,
    userId: u.id,
    input: {
      name: "Agents",
      keywords: ["agents"],
      language: "tr",
      voice_samples: ["Kısa yazarım."],
    },
  });
  if (!niche.ok) throw new Error("niche");
  return u;
}

const controls = {
  platform: "x",
  format: "thread",
  tone: "analytical",
  audience: "developers",
  length: "short",
  user_take: "Tracing wins",
};
const noop = async () => {};

describe("requestBrief", () => {
  test("queues a brief and enqueues generation", async () => {
    const u = await user();
    const events: unknown[] = [];
    const result = await requestBrief({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      controls,
      send: async (e) => void events.push(e),
    });
    expect(result.status).toBe("queued");
    if (result.status !== "queued") return;
    const { data } = await db
      .from("briefs")
      .select("status, user_id, platform, user_take")
      .eq("id", result.briefId)
      .single();
    expect(data).toEqual({
      status: "queued",
      user_id: u.id,
      platform: "x",
      user_take: "Tracing wins",
    });
    expect(events).toEqual([
      { name: "studio/brief.requested", data: { briefId: result.briefId } },
    ]);
  });

  test("unpublished stories are not found", async () => {
    const u = await user();
    expect(
      await requestBrief({
        userDb: u.client,
        admin: db,
        userId: u.id,
        storyId: pendingStoryId,
        controls,
        send: noop,
      }),
    ).toEqual({ status: "not_found" });
  });

  test("the 6th brief of the day hits the limit", async () => {
    const u = await user();
    const ask = () =>
      requestBrief({
        userDb: u.client,
        admin: db,
        userId: u.id,
        storyId,
        controls,
        send: noop,
      });
    for (let i = 0; i < LIMITS.briefsPerDay!; i++)
      expect((await ask()).status).toBe("queued");
    expect(await ask()).toEqual({ status: "limit" });
  });

  test("a failed enqueue marks the brief failed and gives the usage back", async () => {
    const u = await user();
    await expect(
      requestBrief({
        userDb: u.client,
        admin: db,
        userId: u.id,
        storyId,
        controls,
        send: async () => {
          throw new Error("inngest down");
        },
      }),
    ).rejects.toThrow("inngest down");
    const { data: briefs } = await db
      .from("briefs")
      .select("status")
      .eq("user_id", u.id);
    expect(briefs).toEqual([{ status: "failed" }]);
    const { data: usage } = await db
      .from("usage_counters")
      .select("count")
      .eq("user_id", u.id)
      .eq("kind", "brief")
      .single();
    expect(usage!.count).toBe(0);
  });
});

describe("generateBrief", () => {
  test("builds both packs, adds sources from story_sources and the disclosure, versions it", async () => {
    const u = await user();
    const queued = await requestBrief({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      controls,
      send: noop,
    });
    if (queued.status !== "queued") throw new Error("not queued");
    const prompts: string[] = [];

    await generateBrief(
      { db, llm: { model: mockModel(prompts), id: MODEL_ID } },
      queued.briefId,
    );

    const { data: brief } = await db
      .from("briefs")
      .select("*")
      .eq("id", queued.briefId)
      .single();
    expect(brief!.status).toBe("ready");
    expect(brief!.model).toBe(MODEL_ID);
    expect(brief!.tokens_in).toBe(2000);
    const output = brief!.output as Record<string, unknown>;
    expect(output).toMatchObject({ ...short, ...long });
    expect(
      (output.sources as { url: string }[]).map((s) => s.url).sort(),
    ).toEqual(sourceRows.map((s) => s.url).sort());
    expect(output.ai_disclosure).toMatch(/yapay zek/i);
    expect(prompts).toHaveLength(2);
    expect(prompts.join()).toContain("Turkish");
    expect(prompts.join()).toContain("Kısa yazarım.");

    const { count } = await db
      .from("brief_versions")
      .select("*", { count: "exact", head: true })
      .eq("brief_id", queued.briefId);
    expect(count).toBe(1);
  });

  test("invalid model output fails the brief and gives the usage back", async () => {
    const u = await user();
    const queued = await requestBrief({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      controls,
      send: noop,
    });
    if (queued.status !== "queued") throw new Error("not queued");
    await expect(
      generateBrief(
        { db, llm: { model: mockModel([], true), id: MODEL_ID } },
        queued.briefId,
      ),
    ).rejects.toThrow();
    const { data: brief } = await db
      .from("briefs")
      .select("status, error")
      .eq("id", queued.briefId)
      .single();
    expect(brief!.status).toBe("failed");
    expect(brief!.error).toBeTruthy();
    const { data: usage } = await db
      .from("usage_counters")
      .select("count")
      .eq("user_id", u.id)
      .eq("kind", "brief")
      .single();
    expect(usage!.count).toBe(0);
  });
});

describe("editing, publishing, regenerating", () => {
  test("owner saves edits and publishes; others cannot", async () => {
    const owner = await user();
    const other = await user();
    const queued = await requestBrief({
      userDb: owner.client,
      admin: db,
      userId: owner.id,
      storyId,
      controls,
      send: noop,
    });
    if (queued.status !== "queued") throw new Error("not queued");
    await generateBrief(
      { db, llm: { model: mockModel(), id: MODEL_ID } },
      queued.briefId,
    );

    const edited = { x_thread: ["1/ Benim tweetim", "2/ İkinci"] };
    expect(
      await saveEdits(owner.client, queued.briefId, {
        edited,
        selected_hook: 2,
      }),
    ).toBe(true);
    expect(
      await saveEdits(other.client, queued.briefId, {
        edited: { x: 1 },
        selected_hook: 0,
      }),
    ).toBe(false);

    expect(
      await publishBrief(
        owner.client,
        queued.briefId,
        "https://x.com/me/status/1",
      ),
    ).toBe(true);
    await expect(
      publishBrief(owner.client, queued.briefId, "javascript:alert(1)"),
    ).rejects.toThrow();

    const { data } = await db
      .from("briefs")
      .select("edited, selected_hook, published_url, published_at")
      .eq("id", queued.briefId)
      .single();
    expect(data).toMatchObject({
      edited,
      selected_hook: 2,
      published_url: "https://x.com/me/status/1",
    });
    expect(data!.published_at).not.toBeNull();
  });

  test("regenerate queues a new generation, counts against the limit, and adds a version", async () => {
    const u = await user();
    const queued = await requestBrief({
      userDb: u.client,
      admin: db,
      userId: u.id,
      storyId,
      controls,
      send: noop,
    });
    if (queued.status !== "queued") throw new Error("not queued");
    await generateBrief(
      { db, llm: { model: mockModel(), id: MODEL_ID } },
      queued.briefId,
    );
    await saveEdits(u.client, queued.briefId, {
      edited: { linkedin_post: "mine" },
      selected_hook: 1,
    });

    const again = await requestRegenerate({
      userDb: u.client,
      admin: db,
      userId: u.id,
      briefId: queued.briefId,
      controls: { ...controls, tone: "fun" },
      send: noop,
    });
    expect(again).toEqual({ status: "queued", briefId: queued.briefId });
    const { data: requeued } = await db
      .from("briefs")
      .select("status, tone")
      .eq("id", queued.briefId)
      .single();
    expect(requeued).toEqual({ status: "queued", tone: "fun" });

    await generateBrief(
      { db, llm: { model: mockModel(), id: MODEL_ID } },
      queued.briefId,
    );
    const { count } = await db
      .from("brief_versions")
      .select("*", { count: "exact", head: true })
      .eq("brief_id", queued.briefId);
    expect(count).toBe(2);
    const { data: usage } = await db
      .from("usage_counters")
      .select("count")
      .eq("user_id", u.id)
      .eq("kind", "brief")
      .single();
    expect(usage!.count).toBe(2);
  });
});
