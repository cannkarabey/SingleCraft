import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SourceType } from "@/lib/pipeline/types";
import type { Json } from "@/lib/supabase/types";

export const db = createAdminClient();

/** Creates a source (deleted with all its items by `cleanup`). */
export async function makeSource(
  created: string[],
  type: SourceType = "rss",
  config: Record<string, Json> = { niche_specific: true },
  trust = 0.8,
) {
  const id = randomUUID();
  const { error } = await db.from("sources").insert({
    id,
    name: `test ${type} ${id.slice(0, 8)}`,
    type,
    url: `https://${type}.test/${id}`,
    trust_weight: trust,
    config,
  });
  if (error) throw error;
  created.push(id);
  return id;
}

let seq = 0;
/** Inserts an item directly in the given filter state. */
export async function makeItem(
  sourceId: string,
  title: string,
  fields: Record<string, unknown> = {},
) {
  const key = `${Date.now()}-${seq++}`;
  const { data, error } = await db
    .from("raw_items")
    .insert({
      source_id: sourceId,
      external_id: key,
      url: `https://item.test/${key}`,
      canonical_url: `https://item.test/${key}`,
      title,
      content_hash: key,
      filter_status: "accepted",
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function cleanup(created: string[]) {
  if (created.length === 0) return;
  const { data } = await db
    .from("story_sources")
    .select("story_id")
    .in("source_id", created);
  const storyIds = [...new Set((data ?? []).map((r) => r.story_id))];
  if (storyIds.length) await db.from("stories").delete().in("id", storyIds);
  await db.from("sources").delete().in("id", created);
}

/** 768-dim vector: mostly `axis`, with an optional small `noise` component on axis 700. */
export function axisVector(axis: number, noise = 0): number[] {
  const v = Array.from({ length: 768 }, () => 0);
  v[axis] = 1;
  v[700] = noise;
  return v;
}
