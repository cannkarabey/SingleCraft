// Reads magic-link emails from the local Supabase Mailpit.
const MAILPIT = "http://127.0.0.1:54324";

export async function latestMagicLink(
  to: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const { messages = [] } = (await res.json()) as {
      messages?: { ID: string }[];
    };
    if (messages[0]) {
      const msg = (await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      ).json()) as {
        HTML: string;
        Text: string;
      };
      const match =
        (msg.HTML || msg.Text).match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/) ??
        (msg.Text || "").match(/(http\S*\/auth\/v1\/verify\S*)/);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic link email for ${to}`);
}
