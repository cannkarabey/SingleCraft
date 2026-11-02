import { describe, expect, test } from "vitest";
import { renderAlert, renderDigest } from "@/lib/email/render";

const digest = {
  locale: "tr" as const,
  appUrl: "https://app.test",
  unsubscribeUrl: "https://app.test/api/email/unsubscribe?u=1&t=abc&list=digest",
  stories: [
    { id: "s1", title: "Agents SDK <ships>", summary: "Tracing built in.", slug: "agents-sdk" },
    { id: "s2", title: "Rust 2.0", summary: null, slug: null },
  ],
  publishCheck: { briefId: "b1", storyTitle: "Yesterday's story" },
};

describe("renderDigest", () => {
  test("Turkish digest with story links, brief deep links, publish check and unsubscribe", async () => {
    const mail = await renderDigest(digest);
    expect(mail.subject).toMatch(/günlük/i);
    expect(mail.html).toContain("https://app.test/discover/agents-sdk");
    expect(mail.html).toContain("https://app.test/discover/s2");
    expect(mail.html).toContain("https://app.test/studio/new?story=s1");
    expect(mail.html).toContain("https://app.test/studio/b1");
    expect(mail.html).toContain("Yayınladın mı?");
    expect(mail.html).toContain(digest.unsubscribeUrl.replace(/&/g, "&amp;"));
    expect(mail.html).toContain("Agents SDK &lt;ships&gt;");
    expect(mail.text).toContain("Agents SDK <ships>");
  });

  test("English and no publish check", async () => {
    const mail = await renderDigest({ ...digest, locale: "en", publishCheck: null });
    expect(mail.subject).toMatch(/daily/i);
    expect(mail.html).not.toContain("studio/b1");
  });
});

describe("renderAlert", () => {
  test("alert for one story with its score", async () => {
    const mail = await renderAlert({
      locale: "en",
      appUrl: "https://app.test",
      unsubscribeUrl: "https://app.test/api/email/unsubscribe?u=1&t=abc&list=alerts",
      nicheName: "AI agents",
      story: { id: "s1", title: "Agents SDK ships", summary: "Tracing.", slug: "agents-sdk", score: 88.4 },
    });
    expect(mail.subject).toContain("Agents SDK ships");
    expect(mail.html).toContain("88");
    expect(mail.html).toContain("AI agents");
    expect(mail.html).toContain("https://app.test/studio/new?story=s1");
  });
});
