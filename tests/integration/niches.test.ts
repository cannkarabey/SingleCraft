import { afterAll, describe, expect, test } from "vitest";
import {
  createNiche,
  listNiches,
  NicheInput,
  updateNiche,
} from "@/lib/radar/niches";
import { db } from "./helpers";
import { makeUser } from "./users";

const cleanups: (() => Promise<void>)[] = [];
afterAll(async () => {
  for (const c of cleanups) await c();
});

async function user(plan?: "free" | "creator") {
  const u = await makeUser(plan);
  cleanups.push(u.remove);
  return u;
}

const input: NicheInput = {
  name: "AI agents",
  keywords: ["agents", "LLM"],
  excluded_keywords: ["crypto"],
  platforms: ["x", "linkedin"],
  tone: "analytical",
  language: "tr",
  tracked_channels: [],
};

describe("NicheInput", () => {
  test("accepts a valid niche", () => {
    expect(NicheInput.safeParse(input).success).toBe(true);
  });
  test.each([
    { ...input, name: "" },
    { ...input, keywords: Array.from({ length: 21 }, (_, i) => `k${i}`) },
    { ...input, platforms: ["myspace"] },
    { ...input, tone: "angry" },
    { ...input, voice_samples: ["a", "b", "c", "d"] },
  ])("rejects invalid input %#", (bad) => {
    expect(NicheInput.safeParse(bad).success).toBe(false);
  });
});

describe("createNiche", () => {
  test("creates the niche, normalises keywords and marks the user onboarded", async () => {
    const u = await user();
    const result = await createNiche({
      admin: db,
      userId: u.id,
      input: { ...input, keywords: [" agents ", "LLM", "agents"] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.niche).toMatchObject({
      user_id: u.id,
      name: "AI agents",
      keywords: ["agents", "llm"],
    });
    const { data: profile } = await db
      .from("profiles")
      .select("onboarded_at")
      .eq("id", u.id)
      .single();
    expect(profile!.onboarded_at).not.toBeNull();
  });

  test("free plan allows one niche", async () => {
    const u = await user();
    expect((await createNiche({ admin: db, userId: u.id, input })).ok).toBe(
      true,
    );
    expect(await createNiche({ admin: db, userId: u.id, input })).toEqual({
      ok: false,
      error: "limit",
    });
  });

  test("creator plan allows three", async () => {
    const u = await user("creator");
    for (let i = 0; i < 3; i++)
      expect((await createNiche({ admin: db, userId: u.id, input })).ok).toBe(
        true,
      );
    expect((await createNiche({ admin: db, userId: u.id, input })).ok).toBe(
      false,
    );
  });
});

describe("updateNiche / listNiches", () => {
  test("owner can update and list; others cannot touch it", async () => {
    const owner = await user();
    const other = await user();
    const created = await createNiche({ admin: db, userId: owner.id, input });
    if (!created.ok) throw new Error("create failed");

    const updated = await updateNiche(owner.client, created.niche.id, {
      ...input,
      name: "Agents & LLMs",
    });
    expect(updated?.name).toBe("Agents & LLMs");
    expect((await listNiches(owner.client)).map((n) => n.id)).toEqual([
      created.niche.id,
    ]);

    expect(
      await updateNiche(other.client, created.niche.id, {
        ...input,
        name: "hijack",
      }),
    ).toBeNull();
    expect(await listNiches(other.client)).toEqual([]);
  });
});
