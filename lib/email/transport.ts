export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

const DEFAULT_FROM = "SignalCraft <noreply@signalcraft.local>";
const TIMEOUT_MS = 15_000;

/**
 * Resend in production (RESEND_API_KEY, EMAIL_FROM). Without a key, outside production,
 * mail goes to the local Supabase Mailpit so it can be read at http://127.0.0.1:54324.
 */
export async function sendEmail(
  mail: OutgoingEmail,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  const key = process.env.RESEND_API_KEY;

  if (key) {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: mail.headers,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok)
      throw new Error(
        `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    return { id: ((await res.json()) as { id: string }).id };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RESEND_API_KEY is not set; refusing to drop emails in production",
    );
  }

  const mailpit = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
  const match = from.match(/^(.*)<(.+)>$/);
  const res = await fetchImpl(`${mailpit}/api/v1/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      From: match
        ? { Name: match[1].trim(), Email: match[2] }
        : { Email: from },
      To: [{ Email: mail.to }],
      Subject: mail.subject,
      HTML: mail.html,
      Text: mail.text,
      Headers: mail.headers,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(
      `Mailpit ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  return { id: ((await res.json()) as { ID: string }).ID };
}
