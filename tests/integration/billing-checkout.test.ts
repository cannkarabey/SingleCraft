import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest";
import { portalFor, startCheckout } from "@/lib/billing/checkout";
import { POST } from "@/app/api/billing/webhook/route";
import { configureBilling, subscriptionWebhook } from "./billing-support";
import { makeUser } from "./users";

const cleanups: (() => Promise<unknown>)[] = [];
const env = { ...process.env };
beforeEach(() => {
  configureBilling();
  process.env.LEMONSQUEEZY_API_KEY = "ls_test";
  process.env.LEMONSQUEEZY_STORE_ID = "1234";
});
afterEach(() => {
  process.env = { ...env };
});
afterAll(async () => {
  for (const c of cleanups) await c();
});

function fakeFetch(body: object) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("startCheckout", () => {
  test("returns the hosted checkout URL for the plan's variant", async () => {
    const { impl, calls } = fakeFetch({ data: { attributes: { url: "https://checkout.test/x" } } });
    const result = await startCheckout(
      { userId: "u1", email: "a@test.dev", plan: "creator", appUrl: "https://app.test" },
      impl,
    );
    expect(result).toEqual({ status: "ok", url: "https://checkout.test/x" });
    expect(calls).toEqual(["https://api.lemonsqueezy.com/v1/checkouts"]);
  });

  test("not configured / plan not on sale", async () => {
    delete process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
    expect(await startCheckout({ userId: "u1", email: null, plan: "pro", appUrl: "https://app.test" }, fakeFetch({}).impl)).toEqual({
      status: "unavailable",
    });
    delete process.env.LEMONSQUEEZY_API_KEY;
    expect(await startCheckout({ userId: "u1", email: null, plan: "creator", appUrl: "https://app.test" }, fakeFetch({}).impl)).toEqual({
      status: "not_configured",
    });
  });
});

describe("portalFor", () => {
  test("portal URL for the user's latest subscription; none without one", async () => {
    const u = await makeUser("free");
    cleanups.push(u.remove);
    const { impl } = fakeFetch({ data: { attributes: { urls: { customer_portal: "https://portal.test/me" } } } });
    expect(await portalFor(u.client, impl)).toBeNull();

    await POST(subscriptionWebhook(u.id, { subscriptionId: "sub-portal", updatedAt: new Date().toISOString() }));
    const calls: string[] = [];
    const tracking = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ data: { attributes: { urls: { customer_portal: "https://portal.test/me" } } } }));
    }) as unknown as typeof fetch;
    expect(await portalFor(u.client, tracking)).toBe("https://portal.test/me");
    expect(calls).toEqual(["https://api.lemonsqueezy.com/v1/subscriptions/sub-portal"]);
  });
});
