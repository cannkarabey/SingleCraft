import type { Db } from "./store";

const HOUR_MS = 60 * 60 * 1000;
/** Cosine similarity for joining a cluster, and how far back clusters stay open (plan §5.3). */
export const CLUSTER_THRESHOLD = 0.85;
const CLUSTER_WINDOW_MS = 72 * HOUR_MS;
/** Items embedded per run; bounds embedding quota use. Newest items first. */
const MAX_ITEMS_PER_RUN = 500;
const EMBED_TEXT_CHARS = 1000;

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

function check<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

const toVector = (values: number[]) => `[${values.join(",")}]`;

export type ClusterResult = {
  embedded: number;
  created: number;
  joined: number;
  duplicatesAttached: number;
};

/**
 * Embeds accepted items that are not in a story yet and clusters them (plan §5.3 step 3),
 * then attaches Faz 2 duplicates to their root's story. Must run with concurrency 1.
 */
export async function clusterItems(deps: {
  db: Db;
  embed: EmbedFn;
  now: Date;
}): Promise<ClusterResult> {
  const result: ClusterResult = {
    embedded: 0,
    created: 0,
    joined: 0,
    duplicatesAttached: 0,
  };

  const items = check(
    await deps.db
      .from("raw_items")
      .select("id, title, description, story_sources!left(id)")
      .eq("filter_status", "accepted")
      .is("story_sources", null)
      .order("id", { ascending: false })
      .limit(MAX_ITEMS_PER_RUN),
  );

  if (items.length > 0) {
    const vectors = await deps.embed(
      items.map((item) =>
        `${item.title}\n${item.description ?? ""}`.slice(0, EMBED_TEXT_CHARS),
      ),
    );
    result.embedded = vectors.length;
    const since = new Date(
      deps.now.getTime() - CLUSTER_WINDOW_MS,
    ).toISOString();

    // Oldest first, so an event's earliest report seeds its cluster.
    for (let i = items.length - 1; i >= 0; i--) {
      const [row] = check(
        await deps.db.rpc("cluster_item", {
          p_item_id: items[i].id,
          p_embedding: toVector(vectors[i]),
          p_threshold: CLUSTER_THRESHOLD,
          p_since: since,
        }),
      );
      if (row.created) result.created++;
      else result.joined++;
    }
  }

  result.duplicatesAttached = check(await deps.db.rpc("attach_duplicates"));
  return result;
}
