import { requestJson, type FetchImpl } from "./http";
import type { FetchedItem, FetchResult, Source } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

const QUERY = `query RecentPosts($postedAfter: DateTime!) {
  posts(order: VOTES, postedAfter: $postedAfter, first: 30) {
    edges { node { id name tagline description url website votesCount commentsCount createdAt } }
  }
}`;

type PhPost = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  url: string;
  website: string | null;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
};

type PhResponse = {
  data?: { posts: { edges: { node: PhPost }[] } };
  errors?: { message: string }[];
};

export function parseProductHunt(response: PhResponse): FetchedItem[] {
  return (response.data?.posts.edges ?? []).map(({ node }) => ({
    externalId: node.id,
    // The product's own site dedupes against press coverage; PH's page is the fallback.
    url: node.website || node.url,
    title: node.name,
    description:
      [node.tagline, node.description].filter(Boolean).join(". ") || null,
    contentHtml: null,
    // The public API redacts maker names.
    author: null,
    publishedAt: new Date(node.createdAt),
    metrics: { votes: node.votesCount, comments: node.commentsCount },
    metadata: { producthunt_url: node.url },
  }));
}

/** Top posts of the last 24h. Needs a developer token; without one the source is skipped. */
export async function fetchProductHunt(
  source: Pick<Source, "url">,
  fetchImpl: FetchImpl,
  now: Date,
  token?: string,
): Promise<FetchResult> {
  if (!token) return { items: [] };

  const response = await requestJson<PhResponse>(fetchImpl, source.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        postedAfter: new Date(now.getTime() - DAY_MS).toISOString(),
      },
    }),
  });
  if (response.errors?.length) {
    throw new Error(
      `Product Hunt: ${response.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return { items: parseProductHunt(response) };
}
