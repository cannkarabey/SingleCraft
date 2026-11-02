import type { Database, Json } from "@/lib/supabase/types";

export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type SourceType = Database["public"]["Enums"]["source_type"];

/** What every fetcher returns per item, before normalization. */
export type FetchedItem = {
  externalId: string;
  url: string;
  title: string;
  description?: string | null;
  contentHtml?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
  /** Platform engagement snapshot, e.g. { points, comments } → item_metrics rows. */
  metrics?: Record<string, number>;
  metadata?: Record<string, Json>;
};

export type FetchResult = {
  items: FetchedItem[];
  notModified?: boolean;
  etag?: string | null;
  lastModified?: string | null;
};
