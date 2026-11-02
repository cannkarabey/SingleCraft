import { afterAll, describe, expect, test } from "vitest";
import { clusterItems } from "@/lib/pipeline/stories";
import { axisVector, cleanup, db, makeItem, makeSource } from "./helpers";

const created: string[] = [];
const now = new Date();
afterAll(() => cleanup(created));

// Mock embedder: titles mentioning "agent sdk" share a direction; others get their own.
let nextAxis = 10;
const axes = new Map<string, number>();
async function embed(texts: string[]) {
  return texts.map((text, i) => {
    if (/agent sdk/i.test(text)) return axisVector(1, 0.05 * (i % 3));
    const key = text.split("\n")[0];
    if (!axes.has(key)) axes.set(key, 10 + (nextAxis++ % 680));
    return axisVector(axes.get(key)!);
  });
}

async function storyOf(itemId: number) {
  const { data } = await db
    .from("story_sources")
    .select("story_id")
    .eq("raw_item_id", itemId)
    .single();
  return data?.story_id;
}

describe("clusterItems", () => {
  test("three sources on one event form one story; unrelated items get their own", async () => {
    const [a, b, c, d] = [
      await makeSource(created),
      await makeSource(created, "hn"),
      await makeSource(created, "reddit"),
      await makeSource(created),
    ];
    const i1 = await makeItem(a, "OpenAI ships Agent SDK 2.0");
    const i2 = await makeItem(b, "Agent SDK 2.0 is out (openai.com)");
    const i3 = await makeItem(c, "Thoughts on the new Agent SDK");
    const other = await makeItem(d, "Postgres 18 released with async IO");
    const dup = await makeItem(d, "OpenAI ships Agent SDK 2.0 (mirror)", {
      filter_status: "duplicate",
      duplicate_of: i1,
    });

    const result = await clusterItems({ db, embed, now });
    expect(result.embedded).toBeGreaterThanOrEqual(4);
    expect(result.duplicatesAttached).toBeGreaterThanOrEqual(1);

    const story = await storyOf(i1);
    expect(await storyOf(i2)).toBe(story);
    expect(await storyOf(i3)).toBe(story);
    expect(await storyOf(dup)).toBe(story);
    expect(await storyOf(other)).not.toBe(story);

    const { data } = await db
      .from("stories")
      .select("source_count, status")
      .eq("id", story!)
      .single();
    expect(data).toEqual({ source_count: 4, status: "pending" });

    // Other unclustered rows in the local DB may still be picked up; ours must not move.
    await clusterItems({ db, embed, now });
    const { data: after } = await db
      .from("stories")
      .select("source_count")
      .eq("id", story!)
      .single();
    expect(after!.source_count).toBe(4);
  });

  test("rejected and pending items are not clustered", async () => {
    const s = await makeSource(created);
    const rejected = await makeItem(s, "Rejected thing", {
      filter_status: "rejected",
    });
    const pending = await makeItem(s, "Pending thing", {
      filter_status: "pending",
    });
    await clusterItems({ db, embed, now });
    expect(await storyOf(rejected)).toBeUndefined();
    expect(await storyOf(pending)).toBeUndefined();
  });
});
