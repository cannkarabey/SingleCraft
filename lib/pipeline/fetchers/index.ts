import { fetchFeed } from "./feed";
import { fetchGithub } from "./github";
import { fetchHn } from "./hn";
import type { FetchImpl } from "./http";
import { fetchProductHunt } from "./producthunt";
import type { FetchResult, Source } from "../types";

export type FetchDeps = {
  fetch: FetchImpl;
  now: Date;
  githubToken?: string;
  productHuntToken?: string;
};

export async function fetchSource(
  source: Source,
  deps: FetchDeps,
): Promise<FetchResult> {
  switch (source.type) {
    case "rss":
    case "reddit":
    case "youtube":
    case "arxiv":
      return fetchFeed(source, deps.fetch);
    case "hn":
      return fetchHn(source, deps.fetch);
    case "github":
      return fetchGithub(source, deps.fetch, deps.now, deps.githubToken);
    case "producthunt":
      return fetchProductHunt(
        source,
        deps.fetch,
        deps.now,
        deps.productHuntToken,
      );
    default: {
      const unknown: never = source.type;
      throw new Error(`No fetcher for source type: ${String(unknown)}`);
    }
  }
}
