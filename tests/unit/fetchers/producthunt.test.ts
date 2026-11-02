import { describe, expect, test } from "vitest";
import {
  fetchProductHunt,
  parseProductHunt,
} from "@/lib/pipeline/fetchers/producthunt";
import { fakeFetch, fixture } from "../../helpers/fixtures";
import type { Source } from "@/lib/pipeline/types";

const now = new Date("2026-11-02T12:00:00Z");
const source = { url: "https://api.producthunt.com/v2/api/graphql" } as Source;

describe("parseProductHunt", () => {
  test("maps posts", () => {
    const [post, bare] = parseProductHunt(
      JSON.parse(fixture("api/producthunt.json")),
    );
    expect(post).toEqual({
      externalId: "1001001",
      url: "https://agentdesk.example.com/?ref=producthunt",
      title: "AgentDesk",
      description:
        "Run AI agents on your own laptop. Local-first control panel for coding agents.",
      contentHtml: null,
      author: null,
      publishedAt: new Date("2026-11-02T07:01:00Z"),
      metrics: { votes: 512, comments: 48 },
      metadata: {
        producthunt_url: "https://www.producthunt.com/posts/agentdesk",
      },
    });
    expect(bare.url).toBe("https://www.producthunt.com/posts/nosite");
    expect(bare.description).toBe("Something without a website");
  });
});

describe("fetchProductHunt", () => {
  test("without a token it skips the request", async () => {
    const { impl, requests } = fakeFetch();
    expect(await fetchProductHunt(source, impl, now)).toEqual({ items: [] });
    expect(requests).toHaveLength(0);
  });

  test("posts a GraphQL query for the last 24 hours with the token", async () => {
    const { impl, requests } = fakeFetch(
      new Response(fixture("api/producthunt.json")),
    );
    const result = await fetchProductHunt(source, impl, now, "ph_test");
    const init = requests[0].init!;
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer ph_test",
    );
    const body = JSON.parse(String(init.body));
    expect(body.variables).toEqual({ postedAfter: "2026-11-01T12:00:00.000Z" });
    expect(body.query).toContain("votesCount");
    expect(result.items).toHaveLength(2);
  });

  test("GraphQL errors throw", async () => {
    const { impl } = fakeFetch(
      new Response(JSON.stringify({ errors: [{ message: "bad token" }] })),
    );
    await expect(
      fetchProductHunt(source, impl, now, "ph_test"),
    ).rejects.toThrow(/bad token/);
  });
});
