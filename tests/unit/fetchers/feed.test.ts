import { describe, expect, test } from "vitest";
import { fetchFeed, parseFeed } from "@/lib/pipeline/fetchers/feed";
import { fakeFetch, fixture } from "../../helpers/fixtures";
import type { Source } from "@/lib/pipeline/types";

describe("parseFeed", () => {
  test("RSS 2.0 with content:encoded, CDATA and dc:creator", () => {
    const [first, second] = parseFeed(fixture("feeds/rss2.xml"));
    expect(first).toMatchObject({
      externalId: "post-1001",
      url: "https://blog.example.com/agents-sdk-2?utm_source=rss",
      title: "Introducing Agents SDK 2.0",
      description: "<p>Build agents faster &amp; safer.</p>",
      contentHtml:
        "<p>Today we ship <b>Agents SDK 2.0</b> with tool use and tracing.</p>",
      author: "Ada Lovelace",
      publishedAt: new Date("2026-11-02T08:30:00Z"),
    });
    expect(second).toMatchObject({
      externalId: "https://blog.example.com/second",
      title: "Second post & more",
      description: "Plain description",
    });
  });

  test("single-item feeds", () => {
    expect(parseFeed(fixture("feeds/rss2-single.xml"))).toHaveLength(1);
  });

  test("Atom picks the alternate link and html title", () => {
    const [entry] = parseFeed(fixture("feeds/atom.xml"));
    expect(entry).toMatchObject({
      externalId: "https://changelog.example.com/posts/42",
      url: "https://changelog.example.com/posts/42",
      title: "Faster builds <em>everywhere</em>",
      description: "Builds are now twice as fast.",
      contentHtml: "<p>Builds are now <strong>twice</strong> as fast.</p>",
      author: "Grace Hopper",
      publishedAt: new Date("2026-11-01T12:00:00Z"),
    });
  });

  test("YouTube uses videoId and media:description", () => {
    const [video] = parseFeed(fixture("feeds/youtube.xml"));
    expect(video).toMatchObject({
      externalId: "abc123XYZ",
      url: "https://www.youtube.com/watch?v=abc123XYZ",
      title: "I tried every AI coding agent",
      description: "Comparing five agents on a real codebase.",
      author: "Example Channel",
      metrics: { views: 12345 },
    });
  });

  test("arXiv RSS", () => {
    const [paper] = parseFeed(fixture("feeds/arxiv.xml"));
    expect(paper).toMatchObject({
      externalId: "oai:arXiv.org:2611.01234v1",
      url: "https://arxiv.org/abs/2611.01234",
      title: "Scaling Laws for Tool-Using Agents",
      author: "Alice Smith, Bob Jones",
    });
    expect(paper.description).toContain(
      "We study how agent performance scales",
    );
  });

  test("Reddit Atom", () => {
    const [post] = parseFeed(fixture("feeds/reddit.xml"));
    expect(post).toMatchObject({
      externalId: "t3_1abcde",
      url: "https://www.reddit.com/r/LocalLLaMA/comments/1abcde/new_8b_model/",
      title: "New 8B model beats last year's 70B",
      author: "/u/someone",
      publishedAt: new Date("2026-11-02T08:55:00Z"),
    });
  });

  test("GitHub releases Atom falls back to updated", () => {
    const [release] = parseFeed(fixture("feeds/github-releases.xml"));
    expect(release).toMatchObject({
      externalId: "tag:github.com,2008:Repository/70107786/v17.0.0",
      url: "https://github.com/vercel/next.js/releases/tag/v17.0.0",
      title: "v17.0.0",
      publishedAt: new Date("2026-11-01T18:00:00Z"),
    });
  });

  test("skips entries without a link or title", () => {
    const xml = `<rss><channel><item><title>No link</title></item><item><link>https://x.test/a</link></item></channel></rss>`;
    expect(parseFeed(xml)).toEqual([]);
  });

  test("rejects documents that are not feeds", () => {
    expect(() => parseFeed("<html><body>nope</body></html>")).toThrow(
      /not a feed/i,
    );
  });
});

describe("fetchFeed", () => {
  const source = {
    url: "https://blog.example.com/feed.xml",
    etag: 'W/"abc"',
    last_modified: "Sat, 01 Nov 2026 10:00:00 GMT",
  } as Source;

  test("sends conditional headers and returns cache validators", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("feeds/rss2.xml"), {
        status: 200,
        headers: {
          etag: 'W/"def"',
          "last-modified": "Sun, 02 Nov 2026 09:00:00 GMT",
        },
      }),
    );
    const result = await fetchFeed(source, impl);
    const headers = new Headers(requests[0].init?.headers);
    expect(headers.get("if-none-match")).toBe('W/"abc"');
    expect(headers.get("if-modified-since")).toBe(
      "Sat, 01 Nov 2026 10:00:00 GMT",
    );
    expect(headers.get("user-agent")).toMatch(/SignalCraft/);
    expect(result.items).toHaveLength(2);
    expect(result.etag).toBe('W/"def"');
    expect(result.lastModified).toBe("Sun, 02 Nov 2026 09:00:00 GMT");
  });

  test("304 returns no items", async () => {
    const { impl } = fakeFetch(new Response(null, { status: 304 }));
    expect(await fetchFeed(source, impl)).toEqual({
      items: [],
      notModified: true,
    });
  });

  test("HTTP errors throw with the status", async () => {
    const { impl } = fakeFetch(new Response("nope", { status: 503 }));
    await expect(fetchFeed(source, impl)).rejects.toThrow(/503/);
  });
});
