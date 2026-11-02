import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { POST } from "@/app/api/billing/webhook/route";
import { db } from "./helpers";
import { configureBilling, subscriptionWebhook } from "./billing-support";
import { makeUser } from "./users";

const cleanups: (() => Promise<unknown>)[] = [];
beforeAll(configureBilling);
afterAll(async () => {
  for (const c of cleanups) await c();
});

async function user() {
  const u = await makeUser("free");
  cleanups.push(u.remove);
  return u;
}
const plan = async (id: string) => (await db.from("profiles").select("plan").eq("id", id).single()).data!.plan;

describe("POST /api/billing/webhook", () => {
  test("subscription_created makes the user creator", async () => {
    const u = await user();
    const res = await POST(subscriptionWebhook(u.id, { event: "subscription_created", updatedAt: new Date().toISOString() }));
    expect(res.status).toBe(200);
    expect(await plan(u.id)).toBe("creator");
    const { data } = await db.from("subscriptions").select("provider, status, variant_id").eq("user_id", u.id).single();
    expect(data).toEqual({ provider: "lemonsqueezy", status: "active", variant_id: "5001" });
  });

  test("bad signatures are rejected and change nothing", async () => {
    const u = await user();
    const res = await POST(subscriptionWebhook(u.id, { updatedAt: new Date().toISOString() }, "wrong-secret"));
    expect(res.status).toBe(401);
    expect(await plan(u.id)).toBe("free");
  });

  test("replays and out-of-order events are harmless", async () => {
    const u = await user();
    const t0 = new Date(Date.now() - 60_000).toISOString();
    const t1 = new Date().toISOString();
    await POST(subscriptionWebhook(u.id, { status: "active", updatedAt: t1 }));
    await POST(subscriptionWebhook(u.id, { status: "active", updatedAt: t1 }));
    await POST(subscriptionWebhook(u.id, { status: "expired", updatedAt: t0 }));
    expect(await plan(u.id)).toBe("creator");
    const { count } = await db.from("subscriptions").select("*", { count: "exact", head: true }).eq("user_id", u.id);
    expect(count).toBe(1);
  });

  test("non-subscription events are acknowledged and ignored", async () => {
    const u = await user();
    const req = subscriptionWebhook(u.id, { event: "order_created", updatedAt: new Date().toISOString() });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await plan(u.id)).toBe("free");
  });

  test("events for unknown users are acknowledged without effect", async () => {
    const res = await POST(
      subscriptionWebhook("00000000-0000-4000-8000-000000000000", { updatedAt: new Date().toISOString() }),
    );
    expect(res.status).toBe(200);
  });
});
