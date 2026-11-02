import { requestJson, type FetchImpl } from "./http";
import type { FetchedItem, FetchResult, Source } from "../types";

const SEARCH_URL = "https://hn.algolia.com/api/v1/search";
const PAGE_SIZE = 50;
const IDS_PER_REQUEST = 50;

type HnHit = {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  story_text: string | null;
};

type HnResponse = { hits: HnHit[] };

const itemUrl = (id: string) => `https://news.ycombinator.com/item?id=${id}`;

export function parseHn(response: HnResponse): FetchedItem[] {
  return response.hits
    .filter((hit) => hit.title)
    .map((hit) => ({
      externalId: hit.objectID,
      // Link posts point at the article so they dedupe against the publisher's own feed.
      url: hit.url || itemUrl(hit.objectID),
      title: hit.title!,
      description: null,
      contentHtml: hit.story_text,
      author: hit.author,
      publishedAt: new Date(hit.created_at),
      metrics: { points: hit.points ?? 0, comments: hit.num_comments ?? 0 },
      metadata: { hn_url: itemUrl(hit.objectID) },
    }));
}

export async function fetchHn(
  source: Pick<Source, "url">,
  fetchImpl: FetchImpl,
): Promise<FetchResult> {
  const url = new URL(source.url);
  url.searchParams.set("hitsPerPage", String(PAGE_SIZE));
  return {
    items: parseHn(await requestJson<HnResponse>(fetchImpl, url.toString())),
  };
}

/** Current points/comments for known HN stories, for the metrics refresh job. */
export async function hnItemsByIds(
  ids: string[],
  fetchImpl: FetchImpl,
): Promise<FetchedItem[]> {
  const items: FetchedItem[] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    const batch = ids.slice(i, i + IDS_PER_REQUEST);
    const url = new URL(SEARCH_URL);
    url.searchParams.set(
      "tags",
      `(${batch.map((id) => `story_${id}`).join(",")})`,
    );
    url.searchParams.set("hitsPerPage", String(batch.length));
    items.push(
      ...parseHn(await requestJson<HnResponse>(fetchImpl, url.toString())),
    );
  }
  return items;
}
