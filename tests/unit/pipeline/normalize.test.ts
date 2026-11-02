import { describe, expect, test } from "vitest";
import { normalizeItem } from "@/lib/pipeline/normalize";
import { contentHash } from "@/lib/pipeline/text";
import { simhash } from "@/lib/pipeline/simhash";

const base = {
  externalId: "guid-1",
  url: "https://www.Example.com/post/?utm_source=rss",
  title: "  Anthropic &amp; friends ship a <b>new</b> model  ",
  description:
    "<p>A short summary of the release for developers and researchers.</p>",
  contentHtml:
    "<p>The new model improves coding and tool use. It is available in the API for developers today.</p>",
  author: "Jane",
  publishedAt: new Date("2026-11-02T08:00:00Z"),
  metrics: { points: 10 },
  metadata: { feed: "x" },
};

describe("normalizeItem", () => {
  test("produces raw_items columns", () => {
    const n = normalizeItem(base);
    expect(n.external_id).toBe("guid-1");
    expect(n.url).toBe(base.url);
    expect(n.canonical_url).toBe("https://example.com/post");
    expect(n.title).toBe("Anthropic & friends ship a new model");
    expect(n.description).toBe(
      "A short summary of the release for developers and researchers.",
    );
    expect(n.content_text).toBe(
      "The new model improves coding and tool use. It is available in the API for developers today.",
    );
    expect(n.author).toBe("Jane");
    expect(n.published_at).toBe("2026-11-02T08:00:00.000Z");
    expect(n.language).toBe("en");
    expect(n.content_hash).toBe(contentHash(n.title, n.content_text));
    expect(n.simhash).toBe(simhash(`${n.title} ${n.description}`).toString());
    expect(n.raw_metadata).toEqual({ feed: "x" });
  });

  test("falls back to description when there is no content", () => {
    const n = normalizeItem({ ...base, contentHtml: null });
    expect(n.content_text).toBe(
      "A short summary of the release for developers and researchers.",
    );
  });

  test("caps content_text at 4000 chars", () => {
    const n = normalizeItem({ ...base, contentHtml: "word ".repeat(2000) });
    expect(n.content_text.length).toBeLessThanOrEqual(4000);
  });

  test("handles missing optional fields", () => {
    const n = normalizeItem({
      externalId: "x",
      url: "https://e.com/a",
      title: "Title only",
    });
    expect(n.description).toBeNull();
    expect(n.content_text).toBe("");
    expect(n.author).toBeNull();
    expect(n.published_at).toBeNull();
    expect(n.raw_metadata).toEqual({});
  });

  test("invalid dates become null", () => {
    expect(
      normalizeItem({ ...base, publishedAt: new Date("nope") }).published_at,
    ).toBeNull();
  });

  test("throws on an invalid url", () => {
    expect(() => normalizeItem({ ...base, url: "not a url" })).toThrow();
  });
});

describe("review fixes: Postgres-safe output", () => {
  test("NUL characters are removed from every stored string", () => {
    const n = normalizeItem({
      ...base,
      externalId: "id\u0000x",
      title: "Title\u0000 here",
      author: "Ja\u0000ne",
      metadata: { note: "x\u0000y", nested: { list: ["a\u0000"] } },
    });
    expect(JSON.stringify(n)).not.toContain("\\u0000");
  });
});
