import { fetchFeed } from "./feed";
import { requestJson, type FetchImpl } from "./http";
import type { FetchedItem, FetchResult, Source } from "../types";

const PAGE_SIZE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type GithubRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  created_at: string;
  owner: { login: string };
};

type GithubConfig = { mode?: "search" | "releases"; window_days?: number };

export function parseGithubSearch(response: {
  items: GithubRepo[];
}): FetchedItem[] {
  return response.items.map((repo) => ({
    externalId: String(repo.id),
    url: repo.html_url,
    title: repo.full_name,
    description: repo.description,
    contentHtml: null,
    author: repo.owner.login,
    publishedAt: new Date(repo.created_at),
    metrics: { stars: repo.stargazers_count, forks: repo.forks_count },
    metadata: { language: repo.language, topics: repo.topics ?? [] },
  }));
}

/**
 * GitHub has no trending API (plan §1 #14): "rising repos" = repositories created in
 * the last `window_days`, sorted by stars. `mode: "releases"` sources are Atom feeds.
 */
export async function fetchGithub(
  source: Pick<Source, "url" | "config" | "etag" | "last_modified">,
  fetchImpl: FetchImpl,
  now: Date,
  token?: string,
): Promise<FetchResult> {
  const config = (source.config ?? {}) as GithubConfig;
  if (config.mode === "releases") return fetchFeed(source, fetchImpl);

  const since = new Date(now.getTime() - (config.window_days ?? 7) * DAY_MS);
  const url = new URL(source.url);
  url.searchParams.set("q", `created:>${since.toISOString().slice(0, 10)}`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(PAGE_SIZE));

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  return {
    items: parseGithubSearch(
      await requestJson(fetchImpl, url.toString(), { headers }),
    ),
  };
}
