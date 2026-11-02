import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getRadar, recordSignal } from "@/lib/radar/feed";
import { createNiche } from "@/lib/radar/niches";
import { db } from "./helpers";
import { makeUser } from "./users";

const cleanups: (() => Promise<unknown>)[] = [];
const storyIds: string[] = [];
let tag: string;

beforeAll(async () => {
  tag = `zorblax${Date.now()}`;
  // Six published stories that all match the niche keyword; scores decide the order.
  for (let i = 0; i < 6; i++) {
    const { data } = await db
      .from("stories")
      .insert({
        status: "published",
        title: `${tag} story ${i}`,
        summary: "summary",
        velocity_score: 100 - i,
        engagement_score: 90,
        source_diversity_score: 50,
        freshness_score: 100,
        trust_score: 1,
        first_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    storyIds.push(data!.id);
  }
});

afterAll(async () => {
  await db.from("stories").delete().in("id", storyIds);
  for (const c of cleanups) await c();
});

async function userWithNiche(plan: "free" | "creator") {
  const u = await makeUser(plan);
  cleanups.push(u.remove);
  const created = await createNiche({ admin: db, userId: u.id, input: { name: "Zorblax", keywords: [tag, "story"] } });
  if (!created.ok) throw new Error("niche");
  return { ...u, nicheId: created.niche.id };
}

const rows = (r: Awaited<ReturnType<typeof getRadar>>) => [...r.high, ...r.early, ...r.gaps];

describe("getRadar", () => {
  test("free plan: first 3 rows open, the rest locked without content", async () => {
    const u = await userWithNiche("free");
    const radar = await getRadar(u.client, { nicheId: u.nicheId, plan: "free" });
    const all = rows(radar);
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(all.slice(0, 3).every((r) => !r.locked && r.title)).toBe(true);
    const locked = all.slice(3);
    expect(locked.every((r) => r.locked)).toBe(true);
    for (const row of locked) {
      expect(Object.keys(row).sort()).toEqual(["bucket", "locked"]);
    }
    expect(radar.lockedCount).toBe(locked.length);
  });

  test("creator plan sees everything", async () => {
    const u = await userWithNiche("creator");
    const radar = await getRadar(u.client, { nicheId: u.nicheId, plan: "creator" });
    expect(rows(radar).every((r) => !r.locked)).toBe(true);
    expect(radar.lockedCount).toBe(0);
  });

  test("another user's niche is rejected", async () => {
    const a = await userWithNiche("free");
    const b = await userWithNiche("free");
    await expect(getRadar(b.client, { nicheId: a.nicheId, plan: "free" })).rejects.toThrow();
  });
});

describe("recordSignal", () => {
  test("hide removes the story from Radar for good; save marks it", async () => {
    const u = await userWithNiche("creator");
    await recordSignal(u.client, { userId: u.id, storyId: storyIds[0], action: "hide" });
    await recordSignal(u.client, { userId: u.id, storyId: storyIds[1], action: "save" });
    const all = rows(await getRadar(u.client, { nicheId: u.nicheId, plan: "creator" }));
    const ids = all.map((r) => (r.locked ? null : r.story_id));
    expect(ids).not.toContain(storyIds[0]);
    expect(all.find((r) => !r.locked && r.story_id === storyIds[1])).toMatchObject({ saved: true });
  });
});
