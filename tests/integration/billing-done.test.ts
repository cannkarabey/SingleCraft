import { afterAll, beforeAll, expect, test } from "vitest";
import { POST } from "@/app/api/billing/webhook/route";
import { requestBrief } from "@/lib/studio/generate";
import { db } from "./helpers";
import { configureBilling, subscriptionWebhook } from "./billing-support";
import { makeUser } from "./users";

// IMPLEMENTATION_PLAN §9 Faz 8 "Bitti": a (sandbox) payment makes the plan creator and lifts
// limits; after cancelling, the plan drops to free at the end of the period.
const cleanups: (() => Promise<unknown>)[] = [];
let storyId: string;
beforeAll(async () => {
  configureBilling();
  const { data } = await db
    .from("stories")
    .insert({ status: "published", title: "Billing story" })
    .select("id")
    .single();
  storyId = data!.id;
  cleanups.push(async () => db.from("stories").delete().eq("id", storyId));
});
afterAll(async () => {
  for (const c of cleanups.reverse()) await c();
});

const plan = async (id: string) =>
  (await db.from("profiles").select("plan").eq("id", id).single()).data!.plan;

test("payment → creator without limits; cancel → creator until period end → free", async () => {
  const u = await makeUser("free");
  cleanups.push(u.remove);
  const brief = async () =>
    (
      await requestBrief({
        userDb: u.client,
        admin: db,
        userId: u.id,
        plan: await plan(u.id),
        storyId,
        controls: { platform: "x", format: "thread", tone: "plain" },
        send: async () => {},
      })
    ).status;

  // Free: the 3rd brief of the day is refused.
  expect([await brief(), await brief(), await brief()]).toEqual([
    "queued",
    "queued",
    "limit",
  ]);

  // subscription_created (test-mode payment) → creator, limit lifted.
  const t = (minutes: number) =>
    new Date(Date.now() + minutes * 60_000).toISOString();
  expect(
    (
      await POST(
        subscriptionWebhook(u.id, {
          event: "subscription_created",
          status: "active",
          updatedAt: t(0),
        }),
      )
    ).status,
  ).toBe(200);
  expect(await plan(u.id)).toBe("creator");
  expect(await brief()).toBe("queued");

  // subscription_cancelled: still creator until ends_at.
  const endsAt = t(60 * 24 * 30);
  await POST(
    subscriptionWebhook(u.id, {
      event: "subscription_cancelled",
      status: "cancelled",
      endsAt,
      updatedAt: t(1),
    }),
  );
  expect(await plan(u.id)).toBe("creator");

  // Period over: the daily reconcile (or subscription_expired) moves the user to free.
  const { data: expired } = await db.rpc("expire_subscriptions", {
    p_now: t(60 * 24 * 31),
  });
  expect(expired).toBeGreaterThanOrEqual(1);
  expect(await plan(u.id)).toBe("free");

  await POST(
    subscriptionWebhook(u.id, {
      event: "subscription_expired",
      status: "expired",
      endsAt,
      updatedAt: t(2),
    }),
  );
  expect(await plan(u.id)).toBe("free");
});
