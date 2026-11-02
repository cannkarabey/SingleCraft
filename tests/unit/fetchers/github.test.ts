import { describe, expect, test } from "vitest";
import { fetchGithub, parseGithubSearch } from "@/lib/pipeline/fetchers/github";
import { fakeFetch, fixture } from "../../helpers/fixtures";
import type { Source } from "@/lib/pipeline/types";

const now = new Date("2026-11-02T12:00:00Z");
const searchSource = {
  url: "https://api.github.com/search/repositories",
  config: { mode: "search", window_days: 7, sort: "stars" },
} as unknown as Source;

describe("parseGithubSearch", () => {
  test("maps repositories", () => {
    const [repo, bare] = parseGithubSearch(
      JSON.parse(fixture("api/github-search.json")),
    );
    expect(repo).toEqual({
      externalId: "901234567",
      url: "https://github.com/acme/agent-kit",
      title: "acme/agent-kit",
      description: "Minimal toolkit for building tool-using AI agents",
      contentHtml: null,
      author: "acme",
      publishedAt: new Date("2026-10-29T10:00:00Z"),
      metrics: { stars: 1834, forks: 92 },
      metadata: { language: "TypeScript", topics: ["ai", "agents"] },
    });
    expect(bare.description).toBeNull();
  });
});

describe("fetchGithub", () => {
  test("search mode queries repos created inside the window, sorted by stars", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("api/github-search.json")),
    );
    const result = await fetchGithub(searchSource, impl, now);
    const url = new URL(requests[0].url);
    expect(url.searchParams.get("q")).toBe("created:>2026-10-26");
    expect(url.searchParams.get("sort")).toBe("stars");
    expect(url.searchParams.get("order")).toBe("desc");
    expect(
      new Headers(requests[0].init?.headers).get("authorization"),
    ).toBeNull();
    expect(result.items).toHaveLength(2);
  });

  test("sends the token when given", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("api/github-search.json")),
    );
    await fetchGithub(searchSource, impl, now, "ghp_test");
    expect(new Headers(requests[0].init?.headers).get("authorization")).toBe(
      "Bearer ghp_test",
    );
  });

  test("releases mode reads the Atom feed", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("feeds/github-releases.xml")),
    );
    const result = await fetchGithub(
      {
        url: "https://github.com/vercel/next.js/releases.atom",
        config: { mode: "releases" },
        etag: null,
        last_modified: null,
      } as unknown as Source,
      impl,
      now,
    );
    expect(requests[0].url).toBe(
      "https://github.com/vercel/next.js/releases.atom",
    );
    expect(result.items[0].title).toBe("v17.0.0");
  });
});
