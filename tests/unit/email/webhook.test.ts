import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifySvixSignature } from "@/lib/email/webhook";

const key = Buffer.from("resend-test-secret");
const secret = `whsec_${key.toString("base64")}`;
const now = new Date("2026-11-03T10:00:00Z");
const ts = String(Math.floor(now.getTime() / 1000));

function sign(id: string, timestamp: string, body: string, k = key) {
  return createHmac("sha256", k)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}
const headers = (sig: string, timestamp = ts) =>
  new Headers({
    "svix-id": "msg_1",
    "svix-timestamp": timestamp,
    "svix-signature": sig,
  });

describe("verifySvixSignature (Resend webhooks)", () => {
  const body = '{"type":"email.opened"}';

  test("accepts a valid v1 signature, also among several", () => {
    const sig = sign("msg_1", ts, body);
    expect(verifySvixSignature(body, headers(`v1,${sig}`), secret, now)).toBe(
      true,
    );
    expect(
      verifySvixSignature(body, headers(`v1,bogus v1,${sig}`), secret, now),
    ).toBe(true);
  });

  test("rejects a wrong secret, a changed body and missing headers", () => {
    const bad = sign("msg_1", ts, body, Buffer.from("other"));
    expect(verifySvixSignature(body, headers(`v1,${bad}`), secret, now)).toBe(
      false,
    );
    const sig = sign("msg_1", ts, body);
    expect(
      verifySvixSignature(`${body} `, headers(`v1,${sig}`), secret, now),
    ).toBe(false);
    expect(verifySvixSignature(body, new Headers(), secret, now)).toBe(false);
  });

  test("rejects timestamps older or newer than 5 minutes (replay)", () => {
    const old = String(Number(ts) - 301);
    const sig = sign("msg_1", old, body);
    expect(
      verifySvixSignature(body, headers(`v1,${sig}`, old), secret, now),
    ).toBe(false);
  });
});
