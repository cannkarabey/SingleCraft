import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  billingConfigured,
  createCheckout,
  customerPortalUrl,
  parseSubscriptionEvent,
  planForVariant,
  verifyWebhookSignature,
} from "@/lib/billing/lemonsqueezy";

const raw = readFileSync(
  "tests/fixtures/lemonsqueezy/subscription_created.json",
  "utf8",
);
const env = { ...process.env };
beforeEach(() => {
  process.env.LEMONSQUEEZY_API_KEY = "ls_test";
  process.env.LEMONSQUEEZY_STORE_ID = "1234";
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec";
  process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID = "5001";
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "5002";
});
afterEach(() => {
  process.env = { ...env };
});

function fakeFetch(body: object, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("webhook signature", () => {
  const sign = (body: string, secret = "whsec") =>
    createHmac("sha256", secret).update(body).digest("hex");

  test("valid HMAC-SHA256 of the raw body", () => {
    expect(verifyWebhookSignature(raw, sign(raw), "whsec")).toBe(true);
  });
  test.each([
    ["tampered body", raw.replace("active", "expired"), sign(raw)],
    ["wrong secret", raw, sign(raw, "other")],
    ["missing", raw, null],
    ["not hex", raw, "zz"],
  ])("rejects %s", (_, body, signature) => {
    expect(verifyWebhookSignature(body, signature, "whsec")).toBe(false);
  });
});

describe("parseSubscriptionEvent", () => {
  test("maps a subscription event", () => {
    expect(parseSubscriptionEvent(JSON.parse(raw))).toEqual({
      event: "subscription_created",
      userId: "11111111-1111-1111-1111-111111111111",
      subscriptionId: "987654",
      customerId: "55501",
      variantId: "5001",
      plan: "creator",
      status: "active",
      endsAt: null,
      renewsAt: "2026-12-03T10:00:00.000000Z",
      updatedAt: "2026-11-03T10:00:05.000000Z",
    });
  });

  test("ignores non-subscription events and unknown variants", () => {
    const payload = JSON.parse(raw);
    expect(
      parseSubscriptionEvent({
        ...payload,
        meta: { ...payload.meta, event_name: "order_created" },
        data: { ...payload.data, type: "orders" },
      }),
    ).toBeNull();
    payload.data.attributes.variant_id = 9999;
    expect(parseSubscriptionEvent(payload)).toBeNull();
  });

  test("rejects events without our user id", () => {
    const payload = JSON.parse(raw);
    payload.meta.custom_data = {};
    expect(parseSubscriptionEvent(payload)).toBeNull();
  });
});

test("planForVariant", () => {
  expect(planForVariant("5001")).toBe("creator");
  expect(planForVariant(5002)).toBe("pro");
  expect(planForVariant("1")).toBeNull();
});

describe("API calls", () => {
  test("createCheckout sends store, variant, email and user id; returns the URL", async () => {
    const { impl, calls } = fakeFetch(
      {
        data: {
          attributes: { url: "https://store.lemonsqueezy.com/checkout/buy/x" },
        },
      },
      201,
    );
    const url = await createCheckout(
      {
        variantId: "5001",
        email: "a@test.dev",
        userId: "u-1",
        redirectUrl: "https://app.test/settings?billing=success",
      },
      impl,
    );
    expect(url).toBe("https://store.lemonsqueezy.com/checkout/buy/x");
    expect(calls[0].url).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("authorization")).toBe("Bearer ls_test");
    expect(headers.get("content-type")).toBe("application/vnd.api+json");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.data.relationships.store.data).toEqual({
      type: "stores",
      id: "1234",
    });
    expect(body.data.relationships.variant.data).toEqual({
      type: "variants",
      id: "5001",
    });
    expect(body.data.attributes.checkout_data).toMatchObject({
      email: "a@test.dev",
      custom: { user_id: "u-1" },
    });
    expect(body.data.attributes.product_options.redirect_url).toBe(
      "https://app.test/settings?billing=success",
    );
  });

  test("customerPortalUrl reads a fresh signed portal URL", async () => {
    const { impl, calls } = fakeFetch({
      data: {
        attributes: { urls: { customer_portal: "https://portal.test/x" } },
      },
    });
    expect(await customerPortalUrl("987654", impl)).toBe(
      "https://portal.test/x",
    );
    expect(calls[0].url).toBe(
      "https://api.lemonsqueezy.com/v1/subscriptions/987654",
    );
  });

  test("API errors throw", async () => {
    await expect(
      customerPortalUrl("1", fakeFetch({ errors: [] }, 404).impl),
    ).rejects.toThrow(/404/);
  });

  test("billingConfigured needs key, store and creator variant", () => {
    expect(billingConfigured()).toBe(true);
    delete process.env.LEMONSQUEEZY_API_KEY;
    expect(billingConfigured()).toBe(false);
  });
});
