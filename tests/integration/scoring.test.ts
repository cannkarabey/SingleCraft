import { afterAll, describe, expect, test } from "vitest";
import { scoreStories } from "@/lib/pipeline/stories";
import { cleanup, db, makeItem, makeSource } from "./helpers";

const created: string[] = [];
afterAll(() => cleanup(created));

async function makeStory(
  itemIds: { id: number; source: string }[],
  status: "pending" | "published" | "archived" = "pending",
) {
  const { data: story } = await db
    .from("stories")
    .insert({ status, source_count: itemIds.length })
    .select("id")
    .single();
  await db.from("story_sources").insert(
    itemIds.map(({ id, source }) => ({
      story_id: story!.id,
      raw_item_id: id,
      source_id: source,
    })),
  );
  return story!.id;
}

describe("scoreStories", () => {
  test("scores live stories, ranks engagement and growth, snapshots trend scores", async () => {
    const hn = await makeSource(created, "hn");
    const blog = await makeSource(
      created,
      "rss",
      { niche_specific: true },
      0.9,
    );
    const hot = await makeItem(hn, "Hot HN story");
    const hotBlog = await makeItem(blog, "Hot story on a blog");
    const cold = await makeItem(hn, "Cold HN story");

    // Every row sets captured_at: bulk inserts with mixed keys send NULL for missing ones.
    const before = new Date(Date.now() - 7 * 3600_000).toISOString();
    const recent = new Date(Date.now() - 60_000).toISOString();
    const { error } = await db.from("item_metrics").insert([
      { raw_item_id: hot, metric: "points", value: 20, captured_at: before },
      { raw_item_id: hot, metric: "points", value: 420, captured_at: recent },
      { raw_item_id: hot, metric: "comments", value: 250, captured_at: recent },
      { raw_item_id: cold, metric: "points", value: 3, captured_at: before },
      { raw_item_id: cold, metric: "points", value: 4, captured_at: recent },
    ]);
    expect(error).toBeNull();

    const hotStory = await makeStory(
      [
        { id: hot, source: hn },
        { id: hotBlog, source: blog },
      ],
      "published",
    );
    const coldStory = await makeStory([{ id: cold, source: hn }]);
    const oldItem = await makeItem(hn, "Archived story");
    const archived = await makeStory([{ id: oldItem, source: hn }], "archived");

    const result = await scoreStories({ db, now: new Date() });
    expect(result.scored).toBeGreaterThanOrEqual(2);

    const { data: rows } = await db
      .from("stories")
      .select(
        "id, global_score, engagement_score, velocity_score, source_diversity_score, freshness_score, trust_score",
      )
      .in("id", [hotStory, coldStory, archived]);
    const byId = new Map(rows!.map((r) => [r.id, r]));
    const h = byId.get(hotStory)!;
    const c = byId.get(coldStory)!;

    expect(h.global_score).toBeGreaterThan(c.global_score);
    expect(h.engagement_score).toBeGreaterThan(c.engagement_score);
    expect(h.velocity_score).toBeGreaterThanOrEqual(c.velocity_score);
    expect(h.source_diversity_score).toBeGreaterThan(c.source_diversity_score);
    expect(h.freshness_score).toBeGreaterThan(99);
    expect(h.trust_score).toBeCloseTo(0.85);
    expect(byId.get(archived)!.global_score).toBe(0);

    const { data: snapshots } = await db
      .from("trend_scores")
      .select("metric")
      .eq("story_id", hotStory);
    expect(snapshots!.map((s) => s.metric).sort()).toEqual([
      "engagement",
      "global",
      "velocity",
    ]);

    // Only published stories get trend snapshots (review I6: table growth).
    const { count: pendingSnapshots } = await db
      .from("trend_scores")
      .select("*", { count: "exact", head: true })
      .eq("story_id", coldStory);
    expect(pendingSnapshots).toBe(0);
  });
});
