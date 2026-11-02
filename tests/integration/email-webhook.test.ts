import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { POST } from "@/app/api/email/webhook/route";
import { fakePostHog } from "./analytics-support";
import { db } from "./helpers";
import { makeUser } from "./users";

const key = Buffer.from("resend-it-secret");
const ph = fakePostHog();
let user: Awaited<ReturnType<typeof makeUser>>;
const providerId = `re_${Date.now()}`;

beforeAll(async () => {
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
  user = await makeUser();
  await db.from("email_log").insert({
    user_id: user.id,
    kind: "digest",
    day: "2026-11-03",
    provider_id: providerId,
  });
});

afterAll(async () => {
  ph.restore();
  delete process.env.RESEND_WEBHOOK_SECRET;
  await user.remove();
});

function request(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig =
    signature ??
    createHmac("sha256", key).update(`msg_x.${ts}.${body}`).digest("base64");
  return new Request("http://app.test/api/email/webhook", {
    method: "POST",
    headers: {
      "svix-id": "msg_x",
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
    },
    body,
  });
}
const opened = (emailId: string) => ({
  type: "email.opened",
  created_at: new Date().toISOString(),
  data: { email_id: emailId, to: ["x@test.dev"] },
});

describe("POST /api/email/webhook (digest_opened)", () => {
  test("401 on a bad signature", async () => {
    expect((await POST(request(opened(providerId), "bad"))).status).toBe(401);
  });

  test("first open of a digest emits digest_opened once", async () => {
    expect((await POST(request(opened(providerId)))).status).toBe(200);
    expect((await POST(request(opened(providerId)))).status).toBe(200);
    const events = ph.events.filter((e) => e.event === "digest_opened");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ distinct_id: user.id });
    const { data } = await db
      .from("email_log")
      .select("opened_at")
      .eq("provider_id", providerId)
      .single();
    expect(data!.opened_at).not.toBeNull();
  });

  test("other events and unknown emails are acknowledged", async () => {
    const before = ph.events.length;
    expect(
      (
        await POST(
          request({ type: "email.delivered", data: { email_id: providerId } }),
        )
      ).status,
    ).toBe(200);
    expect((await POST(request(opened("re_unknown")))).status).toBe(200);
    expect(ph.events.length).toBe(before);
  });
});
