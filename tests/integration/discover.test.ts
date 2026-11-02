import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  categoryCounts,
  getStory,
  githubPanel,
  listStories,
  newToolsPanel,
  storyTrend,
  trendingPanel,
} from "@/lib/discover/queries";
import { anon, seedDiscover, type Fixture } from "./discover-fixtures";

const now = new Date();
let f: Fixture;
beforeAll(async () => {
  f = await seedDiscover(now);
});
afterAll(() => f.cleanup());

const mine = (items: { id: string }[]) =>
  items.filter((s) => f.ids.includes(s.id)).map((s) => s.id);

describe("listStories", () => {
  test("published stories only, best first", async () => {
    const { items } = await listStories(anon, {
      range: "week",
      now,
      limit: 50,
    });
    expect(mine(items)).toEqual([f.top.id, f.second.id, f.third.id, f.old.id]);
  });

  test("cards carry platform signals but never full text", async () => {
    const { items } = await listStories(anon, {
      range: "week",
      now,
      limit: 50,
    });
    const top = items.find((s) => s.id === f.top.id)!;
    expect(top.signals).toMatchObject({ hn_points: 412 });
    expect(JSON.stringify(items)).not.toContain("SECRET FULL TEXT");
  });

  test("filters by category", async () => {
    const { items } = await listStories(anon, {
      range: "week",
      category: "developer_tools",
      now,
      limit: 50,
    });
    expect(mine(items)).toEqual([f.second.id]);
  });

  test("filters by time range", async () => {
    const day = await listStories(anon, { range: "24h", now, limit: 50 });
    expect(mine(day.items)).not.toContain(f.old.id);
    expect(mine(day.items)).toContain(f.third.id);
  });

  test("full-text search", async () => {
    const { items } = await listStories(anon, {
      range: "week",
      q: `wombat ${f.tag}`,
      now,
      limit: 50,
    });
    expect(mine(items)).toEqual([f.second.id]);
  });

  test("cursor pages without overlap", async () => {
    const first = await listStories(anon, { range: "week", now, limit: 2 });
    expect(first.nextCursor).toBeTruthy();
    const next = await listStories(anon, {
      range: "week",
      now,
      limit: 2,
      cursor: first.nextCursor!,
    });
    const firstIds = first.items.map((s) => s.id);
    expect(next.items.some((s) => firstIds.includes(s.id))).toBe(false);
    expect(mine([...first.items, ...next.items])).toEqual([
      f.top.id,
      f.second.id,
      f.third.id,
      f.old.id,
    ]);
  });
});

describe("getStory", () => {
  test("by id and by slug, with sources and signals", async () => {
    const byId = await getStory(anon, f.second.id);
    const bySlug = await getStory(anon, f.second.slug!);
    expect(byId?.id).toBe(f.second.id);
    expect(bySlug?.id).toBe(f.second.id);
    expect(byId!.sources).toHaveLength(1);
    expect(byId!.sources[0]).toMatchObject({ source_type: "github" });
    expect(byId!.signals).toMatchObject({ github_stars: 999_999 });
    expect(JSON.stringify(byId)).not.toContain("SECRET FULL TEXT");
  });

  test("unknown or unpublished → null", async () => {
    expect(await getStory(anon, f.pending.id)).toBeNull();
    expect(await getStory(anon, "no-such-story")).toBeNull();
  });
});

describe("side data", () => {
  test("category counts include published stories in range", async () => {
    const counts = await categoryCounts(anon, { range: "week", now });
    expect(counts.ai_tools).toBeGreaterThanOrEqual(1);
    expect(counts.security).toBeGreaterThanOrEqual(1);
  });

  test("panels", async () => {
    expect((await trendingPanel(anon, now)).map((s) => s.id)).toContain(
      f.top.id,
    );
    expect((await newToolsPanel(anon, now)).map((s) => s.id)).toContain(
      f.top.id,
    );
    expect((await githubPanel(anon, now)).map((s) => s.id)).toContain(
      f.second.id,
    );
  });
});

describe("storyTrend (review I2)", () => {
  test("returns the newest 96 points in chronological order", async () => {
    const start = Date.now() - 100 * 30 * 60_000;
    const rows = Array.from({ length: 100 }, (_, i) => ({
      story_id: f.top.id,
      metric: "global",
      value: i,
      calculated_at: new Date(start + i * 30 * 60_000).toISOString(),
    }));
    const { db } = await import("./helpers");
    await db.from("trend_scores").insert(rows);
    const trend = await storyTrend(anon, f.top.id);
    expect(trend).toHaveLength(96);
    expect(trend.at(-1)!.value).toBe(99);
    expect(trend[0].value).toBe(4);
  });
});
