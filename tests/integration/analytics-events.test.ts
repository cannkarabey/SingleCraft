import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { finalizeBrief } from "@/lib/studio/generate";
import { aiDisclosure, BriefOutput } from "@/lib/studio/schema";
import { fakePostHog } from "./analytics-support";
import { db } from "./helpers";
import { makeUser } from "./users";

// Route handlers read the session through these; the test signs in a real user instead.
let session: SupabaseClient<Database>;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => session }));
vi.mock("@/lib/radar/events", () => ({ emitNicheChanged: async () => {} }));

const { POST: createNicheRoute } = await import("@/app/api/radar/niches/route");
const { POST: signalRoute } =
  await import("@/app/api/radar/[storyId]/[action]/route");
const { PUT: editRoute } = await import("@/app/api/studio/briefs/[id]/route");
const { POST: publishRoute } =
  await import("@/app/api/studio/briefs/[id]/publish/route");

const output = BriefOutput.parse({
  hooks: Array.from({ length: 10 }, (_, i) => `Hook ${i}`),
  titles: ["A", "B", "C"],
  x_thread: ["1/ a", "2/ b"],
  linkedin_post: "post",
  shorts_hooks: ["a", "b", "c"],
  shorts_script: { hook: "h", beats: ["b", "c"], cta: "c", duration_sec: 30 },
  newsletter_section: "n",
  blog_draft: "b",
  sources: [],
  ai_disclosure: aiDisclosure("en"),
});

let user: Awaited<ReturnType<typeof makeUser>>;
let storyId: string;
let briefId: string;
const ph = fakePostHog();

beforeAll(async () => {
  user = await makeUser();
  session = user.client;
  const { data: story } = await db
    .from("stories")
    .insert({ status: "published", title: "Analytics story", summary: "s" })
    .select("id")
    .single();
  storyId = story!.id;
  const { data: brief } = await db
    .from("briefs")
    .insert({
      user_id: user.id,
      story_id: storyId,
      platform: "x",
      format: "thread",
      tone: "clear",
      status: "generating",
    })
    .select("id")
    .single();
  briefId = brief!.id;
});

afterAll(async () => {
  ph.restore();
  await user.remove();
  await db.from("stories").delete().eq("id", storyId);
});

const json = (body: unknown) =>
  new Request("http://app.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const names = () => ph.events.map((e) => e.event);

describe("server analytics events (plan §9 Faz 9)", () => {
  test("niche_created", async () => {
    const res = await createNicheRoute(
      json({
        name: "AI agents",
        keywords: ["agents"],
        platforms: ["x"],
        language: "en",
        tone: "analytical",
      }),
    );
    expect(res.status).toBe(201);
    expect(ph.events.at(-1)).toMatchObject({
      event: "niche_created",
      distinct_id: user.id,
    });
  });

  test("story_saved only for save, not hide", async () => {
    const ctx = (action: string) => ({
      params: Promise.resolve({ storyId, action }),
    });
    await signalRoute(json({}), ctx("save"));
    expect(ph.events.at(-1)).toMatchObject({
      event: "story_saved",
      distinct_id: user.id,
      properties: { story_id: storyId },
    });
    const before = ph.events.length;
    await signalRoute(json({}), ctx("hide"));
    expect(ph.events.length).toBe(before);
  });

  test("brief_generated when a generation is stored", async () => {
    await finalizeBrief(db, briefId, {
      output,
      model: "test:model",
      tokensIn: 1,
      tokensOut: 1,
    });
    expect(ph.events.at(-1)).toMatchObject({
      event: "brief_generated",
      distinct_id: user.id,
      properties: { brief_id: briefId },
    });
  });

  test("brief_edited once, on the first edit", async () => {
    const ctx = { params: Promise.resolve({ id: briefId }) };
    const edit = () =>
      editRoute(
        json({ edited: { x_thread: ["1/ mine"] }, selected_hook: 1 }),
        ctx,
      );
    expect((await edit()).status).toBe(200);
    expect((await edit()).status).toBe(200);
    expect(names().filter((n) => n === "brief_edited")).toHaveLength(1);
  });

  test("brief_published once, even when the link is updated", async () => {
    const ctx = { params: Promise.resolve({ id: briefId }) };
    await publishRoute(json({ url: "https://x.com/a/status/1" }), ctx);
    await publishRoute(json({ url: "https://x.com/a/status/2" }), ctx);
    expect(names().filter((n) => n === "brief_published")).toHaveLength(1);
    expect(ph.events.at(-1)).toMatchObject({ distinct_id: user.id });
  });
});
