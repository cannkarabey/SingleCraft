import { describe, expect, test } from "vitest";
import { fetchSource } from "@/lib/pipeline/fetchers";
import { fakeFetch, fixture } from "../../helpers/fixtures";
import type { Source, SourceType } from "@/lib/pipeline/types";

const now = new Date("2026-11-02T12:00:00Z");
const source = (type: SourceType, url: string, config: object = {}) =>
  ({ type, url, config, etag: null, last_modified: null }) as unknown as Source;

describe("fetchSource", () => {
  test.each([
    ["rss", "feeds/rss2.xml"],
    ["reddit", "feeds/reddit.xml"],
    ["youtube", "feeds/youtube.xml"],
    ["arxiv", "feeds/arxiv.xml"],
  ] as const)("%s uses the feed fetcher", async (type, file) => {
    const { impl } = fakeFetch(new Response(fixture(file)));
    const result = await fetchSource(source(type, "https://x.test/feed"), {
      fetch: impl,
      now,
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("hn uses the HN fetcher", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("api/hn-front-page.json")),
    );
    await fetchSource(
      source("hn", "https://hn.algolia.com/api/v1/search?tags=front_page"),
      {
        fetch: impl,
        now,
      },
    );
    expect(new URL(requests[0].url).searchParams.get("hitsPerPage")).toBe("50");
  });

  test("github passes its token", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("api/github-search.json")),
    );
    await fetchSource(
      source("github", "https://api.github.com/search/repositories", {
        mode: "search",
      }),
      {
        fetch: impl,
        now,
        githubToken: "ghp_x",
      },
    );
    expect(new Headers(requests[0].init?.headers).get("authorization")).toBe(
      "Bearer ghp_x",
    );
  });

  test("producthunt passes its token", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("api/producthunt.json")),
    );
    await fetchSource(
      source("producthunt", "https://api.producthunt.com/v2/api/graphql"),
      {
        fetch: impl,
        now,
        productHuntToken: "ph_x",
      },
    );
    expect(requests).toHaveLength(1);
  });

  test("unknown types throw", async () => {
    const { impl } = fakeFetch();
    await expect(
      fetchSource(source("carrier-pigeon" as SourceType, "https://x.test"), {
        fetch: impl,
        now,
      }),
    ).rejects.toThrow(/carrier-pigeon/);
  });
});
