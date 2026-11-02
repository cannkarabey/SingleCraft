import { describe, expect, test } from "vitest";
import { fetchHn, hnItemsByIds, parseHn } from "@/lib/pipeline/fetchers/hn";
import { fakeFetch, fixture } from "../../helpers/fixtures";
import type { Source } from "@/lib/pipeline/types";

const json = () => fixture("api/hn-front-page.json");

describe("parseHn", () => {
  test("maps a link story", () => {
    const [story] = parseHn(JSON.parse(json()));
    expect(story).toEqual({
      externalId: "45810001",
      url: "https://www.anthropic.com/news/claude-5?ref=hn",
      title: "Claude 5 system card",
      description: null,
      contentHtml: null,
      author: "pg_fan",
      publishedAt: new Date("2026-11-02T07:10:00Z"),
      metrics: { points: 412, comments: 238 },
      metadata: { hn_url: "https://news.ycombinator.com/item?id=45810001" },
    });
  });

  test("text posts link to the HN item", () => {
    const [, ask] = parseHn(JSON.parse(json()));
    expect(ask.url).toBe("https://news.ycombinator.com/item?id=45810002");
    expect(ask.contentHtml).toBe(
      "<p>We are trying to pick one &amp; benchmarks disagree.</p>",
    );
  });
});

describe("fetchHn", () => {
  test("requests the source url with a page size", async () => {
    const { impl, requests } = fakeFetch(new Response(json()));
    const result = await fetchHn(
      { url: "https://hn.algolia.com/api/v1/search?tags=front_page" } as Source,
      impl,
    );
    const url = new URL(requests[0].url);
    expect(url.searchParams.get("tags")).toBe("front_page");
    expect(url.searchParams.get("hitsPerPage")).toBe("50");
    expect(result.items).toHaveLength(2);
  });
});

describe("hnItemsByIds", () => {
  test("queries story tags in one OR group", async () => {
    const { impl, requests } = fakeFetch(new Response(json()));
    const items = await hnItemsByIds(["45810001", "45810002"], impl);
    const url = new URL(requests[0].url);
    expect(url.searchParams.get("tags")).toBe(
      "(story_45810001,story_45810002)",
    );
    expect(items.map((i) => i.metrics)).toEqual([
      { points: 412, comments: 238 },
      { points: 95, comments: 120 },
    ]);
  });

  test("batches large id lists", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => String(i + 1));
    const empty = () => new Response(JSON.stringify({ hits: [] }));
    const { impl, requests } = fakeFetch(empty(), empty(), empty());
    await hnItemsByIds(ids, impl);
    expect(requests).toHaveLength(3);
  });

  test("no ids, no request", async () => {
    const { impl, requests } = fakeFetch();
    expect(await hnItemsByIds([], impl)).toEqual([]);
    expect(requests).toHaveLength(0);
  });
});
