import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { checkAlerts } from "@/lib/email/alerts";
import { sendDigests } from "@/lib/email/digest";
import type { OutgoingEmail } from "@/lib/email/transport";
import { createNiche } from "@/lib/radar/niches";
import { db } from "./helpers";
import { makeUser } from "./users";

const cleanups: (() => Promise<unknown>)[] = [];
const storyIds: string[] = [];
let tag: string;
const appUrl = "https://app.test";

beforeAll(async () => {
  tag = `zebu${Date.now()}`;
  for (let i = 0; i < 6; i++) {
    const { data } = await db
      .from("stories")
      .insert({
        status: "published",
        title: `${tag} alert story ${i}`,
        summary: "summary",
        velocity_score: 100 - i,
        engagement_score: 90,
        source_diversity_score: 50,
        freshness_score: 100,
        trust_score: 1,
        global_score: 90,
        first_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    storyIds.push(data!.id);
  }
});
afterAll(async () => {
  await db.from("stories").delete().in("id", storyIds);
  for (const c of cleanups.reverse()) await c();
});

function outbox() {
  const sent: OutgoingEmail[] = [];
  return {
    sent,
    send: async (mail: OutgoingEmail) => (
      sent.push(mail),
      { id: `m${sent.length}` }
    ),
  };
}

async function user(
  opts: { digest?: boolean; alerts?: boolean; threshold?: number } = {},
) {
  const u = await makeUser();
  cleanups.push(u.remove);
  await db
    .from("profiles")
    .update({
      timezone: "UTC",
      digest_hour: new Date().getUTCHours(),
      digest_enabled: opts.digest ?? true,
      alerts_enabled: opts.alerts ?? true,
      locale: "en",
    })
    .eq("id", u.id);
  const niche = await createNiche({
    admin: db,
    userId: u.id,
    input: {
      name: "Zebu",
      keywords: [tag, "story"],
      alert_threshold: opts.threshold ?? 100,
    },
  });
  if (!niche.ok) throw new Error("niche");
  return { ...u, nicheId: niche.niche.id };
}

const to = (box: ReturnType<typeof outbox>, email: string) =>
  box.sent.filter((m) => m.to === email);

describe("sendDigests", () => {
  test("a user gets one digest at their hour, with top stories and one-click unsubscribe", async () => {
    const u = await user();
    const box = outbox();
    await sendDigests({ db, now: new Date(), send: box.send, appUrl });
    const mine = to(box, u.email);
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).toBe("Your daily signals");
    expect(mine[0].html).toContain(`${tag} alert story 0`);
    expect(mine[0].html).toContain(`${appUrl}/studio/new?story=${storyIds[0]}`);
    expect(mine[0].headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
    expect(mine[0].headers["List-Unsubscribe"]).toContain("list=digest");

    const again = outbox();
    await sendDigests({ db, now: new Date(), send: again.send, appUrl });
    expect(to(again, u.email)).toHaveLength(0);
  });

  test("disabled digests get nothing", async () => {
    const off = await user({ digest: false });
    const box = outbox();
    await sendDigests({ db, now: new Date(), send: box.send, appUrl });
    expect(to(box, off.email)).toHaveLength(0);
  });

  test("yesterday's unpublished brief gets a 'did you publish it?' link", async () => {
    const u = await user();
    const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: brief } = await db
      .from("briefs")
      .insert({
        user_id: u.id,
        story_id: storyIds[0],
        platform: "x",
        format: "thread",
        tone: "plain",
        status: "ready",
        created_at: yesterday,
      })
      .select("id")
      .single();
    const box = outbox();
    await sendDigests({ db, now: new Date(), send: box.send, appUrl });
    expect(to(box, u.email)[0].html).toContain(`${appUrl}/studio/${brief!.id}`);
  });

  test("a failed send releases the claim so the next run retries", async () => {
    const u = await user();
    await sendDigests({
      db,
      now: new Date(),
      appUrl,
      send: async (mail) => {
        if (mail.to === u.email) throw new Error("smtp down");
        return { id: "x" };
      },
    });
    const box = outbox();
    await sendDigests({ db, now: new Date(), send: box.send, appUrl });
    expect(to(box, u.email)).toHaveLength(1);
  });
});

describe("checkAlerts", () => {
  test("alerts once per story, at most 3 a day", async () => {
    const u = await user({ threshold: 50 });
    const box = outbox();
    await checkAlerts({ db, now: new Date(), send: box.send, appUrl });
    const first = to(box, u.email);
    expect(first).toHaveLength(3);
    expect(first[0].headers["List-Unsubscribe"]).toContain("list=alerts");

    const again = outbox();
    await checkAlerts({ db, now: new Date(), send: again.send, appUrl });
    expect(to(again, u.email)).toHaveLength(0);
  });

  test("below the threshold or with alerts off, nothing is sent", async () => {
    const high = await user({ threshold: 100 });
    const off = await user({ threshold: 50, alerts: false });
    const box = outbox();
    await checkAlerts({ db, now: new Date(), send: box.send, appUrl });
    expect(to(box, high.email)).toHaveLength(0);
    expect(to(box, off.email)).toHaveLength(0);
  });
});
