import { afterEach, describe, expect, test } from "vitest";
import { sendEmail } from "@/lib/email/transport";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

const mail = {
  to: "a@test.dev",
  subject: "Hi",
  html: "<p>Hi</p>",
  text: "Hi",
  headers: { "List-Unsubscribe": "<https://app.test/u>" },
};

function fakeFetch(response: object) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(response), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("sendEmail", () => {
  test("uses Resend when a key is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "SignalCraft <hi@signalcraft.test>";
    const { impl, calls } = fakeFetch({ id: "resend-1" });
    expect(await sendEmail(mail, impl)).toEqual({ id: "resend-1" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(
      "Bearer re_test",
    );
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      from: "SignalCraft <hi@signalcraft.test>",
      to: ["a@test.dev"],
      subject: "Hi",
      headers: mail.headers,
    });
  });

  test("falls back to the local Mailpit outside production", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.MAILPIT_URL = "http://mailpit.test";
    const { impl, calls } = fakeFetch({ ID: "mp-1" });
    expect(await sendEmail(mail, impl)).toEqual({ id: "mp-1" });
    expect(calls[0].url).toBe("http://mailpit.test/api/v1/send");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      To: [{ Email: "a@test.dev" }],
      Subject: "Hi",
    });
  });

  test("production without a key fails loudly", async () => {
    delete process.env.RESEND_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = "production";
    await expect(sendEmail(mail, fakeFetch({}).impl)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
  });
});
