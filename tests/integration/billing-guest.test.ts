import { describe, expect, test, vi } from "vitest";

// A guest (anonymous session) has no email and may lose the session: it must not be able
// to pay for a plan, which would be attached to a throwaway account.
vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => ({ id: "guest-1", email: null, anonymous: true }),
}));

const { POST: checkout } = await import("@/app/api/billing/checkout/route");
const { POST: portal } = await import("@/app/api/billing/portal/route");

describe("billing routes for guests", () => {
  test("checkout needs an account", async () => {
    const res = await checkout(
      new Request("http://app.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "creator" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  test("customer portal needs an account", async () => {
    expect((await portal()).status).toBe(401);
  });
});
