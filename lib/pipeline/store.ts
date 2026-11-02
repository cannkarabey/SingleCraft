import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TablesUpdate } from "@/lib/supabase/types";
import type { NormalizedItem } from "./normalize";
import type { Source } from "./types";

export type Db = SupabaseClient<Database>;

/** Consecutive fetch failures after which a source is deactivated (plan §5.1). */
export const MAX_CONSECUTIVE_FAILURES = 5;

type Result<T> = { data: T; error: { message: string } | null };

/** PostgREST returns at most this many rows per request (supabase/config.toml max_rows). */
const PAGE_SIZE = 1000;

/** Runs a range query page by page until a short page; `page` must apply a stable order. */
async function allPages<T>(
  page: (from: number, to: number) => PromiseLike<Result<T[] | null>>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const batch = check(await page(from, from + PAGE_SIZE - 1));
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/** Unwraps a query that returns rows. */
function check<T>(result: Result<T>): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined)
    throw new Error("Query returned no data");
  return result.data as NonNullable<T>;
}

/** Fails on error for writes that return no rows. */
function assertOk(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

export async function getSource(db: Db, id: string): Promise<Source> {
  return check(await db.from("sources").select("*").eq("id", id).single());
}

export async function getSources(
  db: Db,
  ids: string[],
): Promise<Map<string, Source>> {
  const rows = check(await db.from("sources").select("*").in("id", ids));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function dueSourceIds(db: Db): Promise<string[]> {
  return check(await db.rpc("due_sources")).map((source) => source.id);
}

const INGEST_BATCH = 500;

/**
 * Inserts new items (existing (source_id, external_id) pairs are left untouched) and
 * returns the row id of every given item plus the ids that were newly inserted.
 */
export async function upsertItems(
  db: Db,
  sourceId: string,
  items: NormalizedItem[],
): Promise<{ ids: Map<string, number>; inserted: number[] }> {
  const ids = new Map<string, number>();
  const inserted: number[] = [];
  // Batches stay under PostgREST's max_rows, which also caps RPC result sets.
  for (let i = 0; i < items.length; i += INGEST_BATCH) {
    const rows = check(
      await db.rpc("ingest_raw_items", {
        p_source_id: sourceId,
        p_items: items.slice(i, i + INGEST_BATCH) as unknown as Json,
      }),
    );
    for (const row of rows) {
      ids.set(row.external_id, row.id);
      if (row.inserted) inserted.push(row.id);
    }
  }
  return { ids, inserted };
}

export async function insertMetrics(
  db: Db,
  rows: { raw_item_id: number; metric: string; value: number }[],
): Promise<void> {
  if (rows.length === 0) return;
  assertOk(await db.from("item_metrics").insert(rows));
}

export async function recordFetchSuccess(
  db: Db,
  sourceId: string,
  validators: { etag?: string | null; lastModified?: string | null } | null,
): Promise<void> {
  const patch: TablesUpdate<"sources"> = {
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  };
  // A 304 keeps the validators we already have.
  if (validators) {
    patch.etag = validators.etag ?? null;
    patch.last_modified = validators.lastModified ?? null;
  }
  assertOk(await db.from("sources").update(patch).eq("id", sourceId));
}

/** Counts a failure; the source still waits its interval before the next attempt. */
export async function recordFetchFailure(
  db: Db,
  source: Source,
  message: string,
): Promise<void> {
  const failures = source.consecutive_failures + 1;
  assertOk(
    await db
      .from("sources")
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error: message.slice(0, 1000),
        consecutive_failures: failures,
        active: failures < MAX_CONSECUTIVE_FAILURES && source.active,
      })
      .eq("id", source.id),
  );
}

export type PendingItem = Pick<
  Database["public"]["Tables"]["raw_items"]["Row"],
  | "id"
  | "source_id"
  | "title"
  | "content_text"
  | "published_at"
  | "language"
  | "raw_metadata"
>;

/** Ids per `id=in.(...)` filter, keeping PostgREST request URLs well under size limits. */
const IDS_PER_QUERY = 200;

export async function pendingItems(
  db: Db,
  ids: number[],
): Promise<PendingItem[]> {
  const rows: PendingItem[] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_QUERY) {
    rows.push(
      ...check(
        await db
          .from("raw_items")
          .select(
            "id, source_id, title, content_text, published_at, language, raw_metadata",
          )
          .in("id", ids.slice(i, i + IDS_PER_QUERY))
          .eq("filter_status", "pending"),
      ),
    );
  }
  return rows.sort((a, b) => a.id - b.id);
}

export async function findDuplicate(
  db: Db,
  itemId: number,
  since: Date,
  maxDistance: number,
): Promise<number | null> {
  const rows = check(
    await db.rpc("find_duplicate", {
      p_item_id: itemId,
      p_since: since.toISOString(),
      p_max_distance: maxDistance,
    }),
  );
  return rows[0]?.duplicate_of ?? null;
}

export async function updateItem(
  db: Db,
  id: number,
  patch: TablesUpdate<"raw_items"> & { raw_metadata?: Json },
): Promise<void> {
  assertOk(await db.from("raw_items").update(patch).eq("id", id));
}

export async function recentHnItems(
  db: Db,
  since: Date,
): Promise<{ id: number; external_id: string }[]> {
  const rows = await allPages((from, to) =>
    db
      .from("raw_items")
      .select("id, external_id, sources!inner(type)")
      .eq("sources.type", "hn")
      .gte("fetched_at", since.toISOString())
      .order("id")
      .range(from, to),
  );
  return rows.map(({ id, external_id }) => ({ id, external_id }));
}

export async function recordPipelineRun(
  db: Db,
  run: { fn: string; startedAt: string; stats?: Json; error?: string },
): Promise<void> {
  assertOk(
    await db.from("pipeline_runs").insert({
      fn: run.fn,
      started_at: run.startedAt,
      finished_at: new Date().toISOString(),
      stats: run.stats ?? null,
      error: run.error ?? null,
    }),
  );
}

/** Ids of every item still waiting for dedupe/filter (recovery after an interrupted run). */
export async function allPendingItemIds(db: Db): Promise<number[]> {
  const rows = await allPages((from, to) =>
    db
      .from("raw_items")
      .select("id")
      .eq("filter_status", "pending")
      .order("id")
      .range(from, to),
  );
  return rows.map((row) => row.id);
}
