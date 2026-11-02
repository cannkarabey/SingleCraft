import { XMLParser } from "fast-xml-parser";
import { request, type FetchImpl } from "./http";
import type { FetchedItem, FetchResult, Source } from "../types";

// RSS 2.0, Atom and RDF in one parser. Namespace prefixes are dropped, so
// content:encoded → encoded, dc:creator → creator, yt:videoId → videoId, media:group → group.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  cdataPropName: false,
});

type Node = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Text of an element that may be a plain string or an object with #text (attributes present). */
function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as Node))
    return text((value as Node)["#text"]);
  if (Array.isArray(value)) return text(value[0]);
  return null;
}

function date(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function atomLink(links: unknown): string | null {
  const all = asArray(links as Node | Node[]);
  const alternate =
    all.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? all[0];
  return alternate ? text(alternate["@_href"]) : null;
}

function rssItem(item: Node): FetchedItem | null {
  const url = text(item.link);
  const title = text(item.title);
  if (!url || !title) return null;
  return {
    externalId: text(item.guid) ?? url,
    url,
    title,
    description: text(item.description),
    contentHtml: text(item.encoded),
    author: text(item.creator) ?? text(item.author),
    publishedAt: date(item.pubDate) ?? date(item.date),
  };
}

function atomEntry(entry: Node): FetchedItem | null {
  const url = atomLink(entry.link);
  const title = text(entry.title);
  if (!url || !title) return null;
  const media = (entry.group ?? {}) as Node;
  const views = Number(
    ((media.community as Node)?.statistics as Node)?.["@_views"],
  );
  const author = asArray(entry.author as Node | Node[])[0];
  return {
    externalId: text(entry.videoId) ?? text(entry.id) ?? url,
    url,
    title,
    description: text(entry.summary) ?? text(media.description),
    contentHtml: text(entry.content),
    author: author ? text(author.name) : null,
    publishedAt: date(entry.published) ?? date(entry.updated),
    ...(Number.isFinite(views) ? { metrics: { views } } : {}),
  };
}

export function parseFeed(xml: string): FetchedItem[] {
  const doc = parser.parse(xml) as Node;
  let items: (FetchedItem | null)[];
  if (doc.rss) {
    items = asArray(
      ((doc.rss as Node).channel as Node)?.item as Node | Node[],
    ).map(rssItem);
  } else if (doc.feed) {
    items = asArray((doc.feed as Node).entry as Node | Node[]).map(atomEntry);
  } else if (doc.RDF) {
    items = asArray((doc.RDF as Node).item as Node | Node[]).map(rssItem);
  } else {
    throw new Error("Document is not a feed (no rss, feed or RDF root)");
  }
  return items.filter((item): item is FetchedItem => item !== null);
}

export async function fetchFeed(
  source: Pick<Source, "url" | "etag" | "last_modified">,
  fetchImpl: FetchImpl,
): Promise<FetchResult> {
  const result = await request(fetchImpl, source.url, {
    etag: source.etag,
    lastModified: source.last_modified,
  });
  if (result.notModified) return { items: [], notModified: true };
  return {
    items: parseFeed(result.body),
    etag: result.etag,
    lastModified: result.lastModified,
  };
}
