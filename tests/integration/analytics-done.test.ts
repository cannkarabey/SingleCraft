import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardEvents } from "@/lib/analytics/dashboard";
import { trackSignup } from "@/lib/analytics/signup";
import { sendDigests } from "@/lib/email/digest";
import { finalizeBrief } from "@/lib/studio/generate";
import { aiDisclosure, BriefOutput } from "@/lib/studio/schema";
import type { Database } from "@/lib/supabase/types";
import { fakePostHog } from "./analytics-support";
import { db } from "./helpers";
import { makeUser } from "./users";

// Faz 9 done: one beta user's journey emits every event the §10 dashboard is built from.
let session: SupabaseClient<Database>;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => session }));
vi.mock("@/lib/radar/events", () => ({ emitNicheChanged: async () => {} }));

const { POST: createNiche } = await import("@/app/api/radar/niches/route");
const { POST: signal } =
  await import("@/app/api/radar/[storyId]/[action]/route");
const { PUT: edit } = await import("@/app/api/studio/briefs/[id]/route");
const { POST: publish } =
  await import("@/app/api/studio/briefs/[id]/publish/route");
const { POST: emailWebhook } = await import("@/app/api/email/webhook/route");

const key = Buffer.from("done-secret");
const ph = fakePostHog();
let user: Awaited<ReturnType<typeof makeUser>>;
let storyId: string;

beforeAll(async () => {
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
  user = await makeUser();
  session = user.client;
  const { data } = await db
    .from("stories")
    .insert({
      status: "published",
      title: "Agents done story",
      summary: "s",
      velocity_score: 80,
      engagement_score: 80,
      source_diversity_score: 50,
      freshness_score: 100,
      trust_score: 1,
      first_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  storyId = data!.id;
});

afterAll(async () => {
  ph.restore();
  delete process.env.RESEND_WEBHOOK_SECRET;
  await user.remove();
  await db.from("stories").delete().eq("id", storyId);
});

const json = (body: unknown) =>
  new Request("http://app.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

function signed(payload: unknown) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", key)
    .update(`m.${ts}.${body}`)
    .digest("base64");
  return new Request("http://app.test", {
    method: "POST",
    headers: {
      "svix-id": "m",
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
    },
    body,
  });
}

describe("Faz 9 done: §10 metrics have their events", () => {
  test("a user's journey emits every dashboard event", async () => {
    expect(await trackSignup(db, user.id)).toBe(true);
    expect(await trackSignup(db, user.id)).toBe(false);

    await createNiche(
      json({ name: "AI agents", keywords: ["agents", "done"], language: "en" }),
    );
    await signal(json({}), {
      params: Promise.resolve({ storyId, action: "save" }),
    });

    const { data: brief } = await db
      .from("briefs")
      .insert({
        user_id: user.id,
        story_id: storyId,
        platform: "x",
        format: "thread",
        tone: "analytical",
        status: "generating",
      })
      .select("id")
      .single();
    await finalizeBrief(db, brief!.id, {
      output: BriefOutput.parse({
        hooks: Array.from({ length: 10 }, (_, i) => `Hook ${i}`),
        titles: ["A", "B", "C"],
        x_thread: ["1/ a", "2/ b"],
        linkedin_post: "p",
        shorts_hooks: ["a", "b", "c"],
        shorts_script: {
          hook: "h",
          beats: ["a", "b"],
          cta: "c",
          duration_sec: 30,
        },
        newsletter_section: "n",
        blog_draft: "b",
        sources: [],
        ai_disclosure: aiDisclosure("en"),
      }),
      model: "test",
      tokensIn: 1,
      tokensOut: 1,
    });
    const ctx = { params: Promise.resolve({ id: brief!.id }) };
    await edit(json({ edited: { x_thread: ["mine"] }, selected_hook: 0 }), ctx);
    await publish(json({ url: "https://x.com/a/status/1" }), ctx);

    // Digest at the user's hour, then Resend reports the open.
    const now = new Date();
    await db
      .from("profiles")
      .update({
        digest_enabled: true,
        timezone: "UTC",
        digest_hour: now.getUTCHours(),
      })
      .eq("id", user.id);
    const emailId = `re_done_${Date.now()}`;
    await sendDigests({
      db,
      now,
      appUrl: "http://app.test",
      // Other local users may be due too; only this user's mail gets the tracked id.
      send: async (mail) => ({
        id: mail.to === user.email ? emailId : `re_other_${randomUUID()}`,
      }),
    });
    expect(
      (
        await emailWebhook(
          signed({ type: "email.opened", data: { email_id: emailId } }),
        )
      ).status,
    ).toBe(200);

    const mine = ph.events.filter((e) => e.distinct_id === user.id);
    const emitted = new Set(mine.map((e) => e.event));
    for (const event of dashboardEvents()) {
      if (event === "$pageview") continue; // client-side (posthog-js)
      expect(emitted, event).toContain(event);
    }
  });
});
