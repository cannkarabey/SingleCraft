import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { sendEmail } from "@/lib/email/transport";

test("local transport delivers to Mailpit", async () => {
  delete process.env.RESEND_API_KEY;
  const to = `mailpit-${randomUUID().slice(0, 8)}@test.dev`;
  await sendEmail({ to, subject: "Mailpit check", html: "<p>ok</p>", text: "ok", headers: {} });
  const res = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  const { messages } = (await res.json()) as { messages: { Subject: string }[] };
  expect(messages.map((m) => m.Subject)).toContain("Mailpit check");
});
