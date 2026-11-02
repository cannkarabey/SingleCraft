import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GET as listGet } from "@/app/api/discover/route";
import { GET as storyGet } from "@/app/api/discover/[storyId]/route";
import { GET as categoriesGet } from "@/app/api/categories/route";
import { GET as trendingGet } from "@/app/api/trending/route";
import { seedDiscover, type Fixture } from "./discover-fixtures";

let f: Fixture;
beforeAll(async () => {
  f = await seedDiscover();
});
afterAll(() => f.cleanup());

const req = (path: string) => new Request(`http://localhost${path}`);
const params = (storyId: string) => ({ params: Promise.resolve({ storyId }) });

describe("GET /api/discover", () => {
  test("lists published stories with a public cache header", async () => {
    const res = await listGet(req("/api/discover?range=week&limit=50"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    const body = await res.json();
    expect(body.items.map((s: { id: string }) => s.id)).toContain(f.top.id);
    expect(body.items.map((s: { id: string }) => s.id)).not.toContain(f.pending.id);
    expect(JSON.stringify(body)).not.toContain("SECRET FULL TEXT");
  });

  test("cursor round trip", async () => {
    const first = await (await listGet(req("/api/discover?range=week&limit=1"))).json();
    expect(first.nextCursor).toBeTruthy();
    const second = await (
      await listGet(req(`/api/discover?range=week&limit=1&cursor=${first.nextCursor}`))
    ).json();
    expect(second.items[0].id).not.toBe(first.items[0].id);
  });

  test("defaults to today when range is missing", async () => {
    expect((await listGet(req("/api/discover"))).status).toBe(200);
  });

  test.each([
    "/api/discover?range=year",
    "/api/discover?category=cooking",
    "/api/discover?limit=0",
    `/api/discover?q=${"x".repeat(201)}`,
  ])("rejects invalid input %s", async (path) => {
    expect((await listGet(req(path))).status).toBe(400);
  });
});

describe("GET /api/discover/[storyId]", () => {
  test("returns a published story by slug", async () => {
    const res = await storyGet(req("/x"), params(f.second.slug!));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(f.second.id);
    expect(body.sources).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("SECRET FULL TEXT");
  });

  test("404 for unknown and unpublished stories", async () => {
    expect((await storyGet(req("/x"), params("nope"))).status).toBe(404);
    expect((await storyGet(req("/x"), params(f.pending.id))).status).toBe(404);
  });
});

describe("side routes", () => {
  test("GET /api/categories counts by category", async () => {
    const body = await (await categoriesGet(req("/api/categories?range=week"))).json();
    expect(body.counts.ai_tools).toBeGreaterThanOrEqual(1);
  });

  test("GET /api/trending panels", async () => {
    for (const panel of ["trending", "new_tools", "github"]) {
      const res = await trendingGet(req(`/api/trending?panel=${panel}`));
      expect(res.status).toBe(200);
      expect(Array.isArray((await res.json()).items)).toBe(true);
    }
    expect((await trendingGet(req("/api/trending?panel=gossip"))).status).toBe(400);
  });
});
