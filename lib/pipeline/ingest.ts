import { fetchSource, type FetchDeps } from "./fetchers";
import { hnItemsByIds } from "./fetchers/hn";
import { filterItem } from "./filter";
import type { DetectedLanguage } from "./language";
import { normalizeItem, type NormalizedItem } from "./normalize";
import {
  findDuplicate,
  getSource,
  getSources,
  insertMetrics,
  pendingItems,
  recentHnItems,
  recordFetchFailure,
  recordFetchSuccess,
  updateItem,
  upsertItems,
  type Db,
} from "./store";
import type { FetchedItem } from "./types";

const HOUR_MS = 60 * 60 * 1000;
/** Window and Hamming threshold for near-duplicate detection (plan §5.3). */
const DEDUPE_WINDOW_MS = 72 * HOUR_MS;
const NEAR_DUPLICATE_DISTANCE = 3;
const METRICS_REFRESH_WINDOW_MS = 48 * HOUR_MS;

type IngestDeps = FetchDeps & { db: Db };

export type IngestResult = {
  sourceId: string;
  inserted: number[];
  seen: number;
  invalid: number;
  error?: string;
};

function metricRows(items: FetchedItem[], ids: Map<string, number>) {
  return items.flatMap((item) => {
    const rawItemId = ids.get(item.externalId);
    if (rawItemId === undefined || !item.metrics) return [];
    return Object.entries(item.metrics)
      .filter(([, value]) => Number.isFinite(value))
      .map(([metric, value]) => ({
        raw_item_id: rawItemId,
        metric,
        value: Math.round(value),
      }));
  });
}

/**
 * Fetches one source, normalizes and stores new items, and snapshots metrics for every
 * item seen. Fetch errors are recorded on the source and returned, not thrown, so one
 * broken feed never fails the whole run.
 */
export async function ingestSource(
  sourceId: string,
  deps: IngestDeps,
): Promise<IngestResult> {
  const source = await getSource(deps.db, sourceId);

  let result;
  try {
    result = await fetchSource(source, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordFetchFailure(deps.db, source, message);
    return { sourceId, inserted: [], seen: 0, invalid: 0, error: message };
  }

  if (result.notModified) {
    await recordFetchSuccess(deps.db, sourceId, null);
    return { sourceId, inserted: [], seen: 0, invalid: 0 };
  }

  const fetched = new Map<string, FetchedItem>();
  const normalized: NormalizedItem[] = [];
  let invalid = 0;
  for (const item of result.items) {
    if (fetched.has(item.externalId)) continue;
    try {
      normalized.push(normalizeItem(item));
      fetched.set(item.externalId, item);
    } catch {
      invalid++;
    }
  }

  const { ids, inserted } = await upsertItems(deps.db, sourceId, normalized);
  await insertMetrics(deps.db, metricRows([...fetched.values()], ids));
  await recordFetchSuccess(deps.db, sourceId, result);

  return { sourceId, inserted, seen: normalized.length, invalid };
}

export type ProcessResult = {
  accepted: number;
  rejected: number;
  duplicate: number;
};

/**
 * Exact/near dedupe against accepted items, then the rule-based filter (plan §5.3–5.4).
 * Only `pending` items are touched, so re-processing is a no-op. Items are handled in id
 * order so an earlier item in the same batch can be the root of a later duplicate.
 */
export async function processItems(
  ids: number[],
  deps: { db: Db; now: Date },
): Promise<ProcessResult> {
  const result: ProcessResult = { accepted: 0, rejected: 0, duplicate: 0 };
  const items = await pendingItems(deps.db, ids);
  if (items.length === 0) return result;

  const sources = await getSources(deps.db, [
    ...new Set(items.map((item) => item.source_id)),
  ]);
  const since = new Date(deps.now.getTime() - DEDUPE_WINDOW_MS);

  for (const item of items) {
    const duplicateOf = await findDuplicate(
      deps.db,
      item.id,
      since,
      NEAR_DUPLICATE_DISTANCE,
    );
    if (duplicateOf !== null) {
      await updateItem(deps.db, item.id, {
        filter_status: "duplicate",
        duplicate_of: duplicateOf,
      });
      result.duplicate++;
      continue;
    }

    const source = sources.get(item.source_id)!;
    const verdict = filterItem(
      {
        title: item.title,
        contentText: item.content_text ?? "",
        publishedAt: item.published_at ? new Date(item.published_at) : null,
        language: item.language as DetectedLanguage | null,
      },
      {
        type: source.type,
        trust_weight: Number(source.trust_weight),
        config: (source.config ?? {}) as { niche_specific?: boolean },
      },
      deps.now,
    );
    const metadata = {
      ...((item.raw_metadata ?? {}) as Record<string, unknown>),
      pre_category: verdict.category,
    };

    if (verdict.status === "accepted") {
      await updateItem(deps.db, item.id, {
        filter_status: "accepted",
        raw_metadata: metadata,
      });
      result.accepted++;
    } else {
      await updateItem(deps.db, item.id, {
        filter_status: "rejected",
        reject_reason: verdict.reason,
        raw_metadata: metadata,
      });
      result.rejected++;
    }
  }
  return result;
}

/** Re-polls points/comments of HN stories from the last 48h, including ones off the feeds. */
export async function refreshHnMetrics(
  deps: Pick<IngestDeps, "db" | "fetch" | "now">,
): Promise<{ items: number; snapshots: number }> {
  const recent = await recentHnItems(
    deps.db,
    new Date(deps.now.getTime() - METRICS_REFRESH_WINDOW_MS),
  );
  if (recent.length === 0) return { items: 0, snapshots: 0 };

  // The same story can live under several HN sources (front page, Show HN).
  const idsByExternal = new Map<string, number[]>();
  for (const { id, external_id } of recent) {
    idsByExternal.set(external_id, [
      ...(idsByExternal.get(external_id) ?? []),
      id,
    ]);
  }

  // One snapshot per story even if the API repeats a hit across batches: a repeated
  // (raw_item_id, metric) pair in one insert would collide on the primary key.
  const fresh = new Map(
    (await hnItemsByIds([...idsByExternal.keys()], deps.fetch)).map((item) => [
      item.externalId,
      item,
    ]),
  );
  const rows = [...fresh.values()].flatMap((item) =>
    (idsByExternal.get(item.externalId) ?? []).flatMap((rawItemId) =>
      Object.entries(item.metrics ?? {}).map(([metric, value]) => ({
        raw_item_id: rawItemId,
        metric,
        value,
      })),
    ),
  );
  await insertMetrics(deps.db, rows);
  return { items: recent.length, snapshots: rows.length };
}
