import { canonicalizeUrl } from "./canonical-url";
import { detectLanguage } from "./language";
import { simhash } from "./simhash";
import { contentHash, stripHtml, truncate } from "./text";
import type { FetchedItem } from "./types";
import type { Json } from "@/lib/supabase/types";

const MAX_CONTENT = 4000;
const MAX_DESCRIPTION = 1000;

export type NormalizedItem = {
  external_id: string;
  url: string;
  canonical_url: string;
  title: string;
  description: string | null;
  content_text: string;
  author: string | null;
  published_at: string | null;
  language: string | null;
  content_hash: string;
  /** Signed 64-bit SimHash as a decimal string: JSON numbers cannot carry 64 bits. */
  simhash: string;
  raw_metadata: Record<string, Json>;
};

function validDate(date: Date | null | undefined): string | null {
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** Maps a fetched item onto raw_items columns (IMPLEMENTATION_PLAN §5.2). */
export function normalizeItem(item: FetchedItem): NormalizedItem {
  const title = stripHtml(item.title);
  const description =
    truncate(stripHtml(item.description), MAX_DESCRIPTION) || null;
  const contentText = truncate(
    stripHtml(item.contentHtml) || (description ?? ""),
    MAX_CONTENT,
  );

  return {
    external_id: item.externalId,
    url: item.url,
    canonical_url: canonicalizeUrl(item.url),
    title,
    description,
    content_text: contentText,
    author: item.author?.trim() || null,
    published_at: validDate(item.publishedAt),
    language: detectLanguage(`${title} ${description ?? ""} ${contentText}`),
    content_hash: contentHash(title, contentText),
    simhash: simhash(`${title} ${description ?? ""}`).toString(),
    raw_metadata: item.metadata ?? {},
  };
}
