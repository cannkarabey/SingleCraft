import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ingestSource,
  processItems,
  refreshHnMetrics,
} from "@/lib/pipeline/ingest";
import { allPendingItemIds } from "@/lib/pipeline/store";
import { fakeFetch, fakeFetchAlways, fixture } from "../helpers/fixtures";
import type { SourceType } from "@/lib/pipeline/types";
import type { Json } from "@/lib/supabase/types";

const db = createAdminClient();
const now = new Date("2026-11-02T12:00:00Z");
const created: string[] = [];

async function makeSource(
  type: SourceType,
  config: Record<string, Json> = { niche_specific: true },
) {
  const id = randomUUID();
  const { error } = await db.from("sources").insert({
    id,
    name: `test ${type} ${id.slice(0, 8)}`,
    type,
    url: `https://${type}.test/${id}${type === "hn" ? "?tags=front_page" : ""}`,
    trust_weight: 0.8,
    config,
  });
  if (error) throw error;
  created.push(id);
  return id;
}

async function source(id: string) {
  const { data } = await db.from("sources").select("*").eq("id", id).single();
  return data!;
}

async function items(sourceId: string) {
  const { data } = await db
    .from("raw_items")
    .select("*")
    .eq("source_id", sourceId)
    .order("id");
  return data!;
}

async function metricCount(rawItemId: number) {
  const { count } = await db
    .from("item_metrics")
    .select("*", { count: "exact", head: true })
    .eq("raw_item_id", rawItemId);
  return count ?? 0;
}

const deps = (...responses: Response[]) => ({
  db,
  fetch: fakeFetch(...responses).impl,
  now,
});

afterAll(async () => {
  if (created.length) await db.from("sources").delete().in("id", created);
});

describe("ingestSource", () => {
  let hn: string;
  beforeEach(async () => {
    hn = await makeSource("hn", { niche_specific: false });
  });

  test("handles large feeds with long ids (no oversized URLs, no 1000-row cap)", async () => {
    const hits = Array.from({ length: 1200 }, (_, i) => ({
      objectID: `${"x".repeat(300)}-${i}`,
      title: `Long id story number ${i} about developer tools`,
      url: `https://long.test/${"p".repeat(200)}/${i}`,
      author: "a",
      points: i,
      num_comments: 0,
      created_at: "2026-11-02T09:00:00Z",
      story_text: null,
    }));
    const body = () => new Response(JSON.stringify({ hits }));

    const first = await ingestSource(hn, deps(body()));
    const second = await ingestSource(hn, deps(body()));

    expect(first.error).toBeUndefined();
    expect(first.inserted).toHaveLength(1200);
    expect(second.inserted).toHaveLength(0);
    expect(second.seen).toBe(1200);
  });

  test("inserts once and snapshots metrics on every fetch", async () => {
    const first = await ingestSource(
      hn,
      deps(new Response(fixture("api/hn-front-page.json"))),
    );
    const second = await ingestSource(
      hn,
      deps(new Response(fixture("api/hn-front-page.json"))),
    );

    expect(first.inserted).toHaveLength(2);
    expect(second.inserted).toHaveLength(0);
    expect(second.seen).toBe(2);

    const rows = await items(hn);
    expect(rows).toHaveLength(2);
    expect(rows[0].canonical_url).toBe("https://anthropic.com/news/claude-5");
    expect(rows[0].filter_status).toBe("pending");
    expect(await metricCount(rows[0].id)).toBe(4); // points + comments, twice
  });

  test("failures are counted and the 5th deactivates the source", async () => {
    for (let i = 1; i <= 5; i++) {
      const result = await ingestSource(
        hn,
        deps(new Response("down", { status: 503 })),
      );
      expect(result.error).toMatch(/503/);
    }
    const row = await source(hn);
    expect(row.consecutive_failures).toBe(5);
    expect(row.active).toBe(false);
    expect(row.last_error).toMatch(/503/);

    // Deactivation is surfaced to admins via pipeline_runs (plan §5.1).
    const { data: alerts } = await db
      .from("pipeline_runs")
      .select("fn, error, stats")
      .eq("fn", "source-deactivated")
      .contains("stats", { source_id: hn });
    expect(alerts).toHaveLength(1);
    expect(alerts![0].error).toMatch(/503/);
  });

  test("storage errors are recorded as a source failure, not thrown", async () => {
    const failingDb = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "rpc") {
          return (fn: string, ...args: unknown[]) =>
            fn === "ingest_raw_items"
              ? Promise.resolve({
                  data: null,
                  error: { message: "boom from storage" },
                })
              : (target.rpc as (...a: unknown[]) => unknown).call(
                  target,
                  fn,
                  ...args,
                );
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const result = await ingestSource(hn, {
      db: failingDb,
      fetch: fakeFetch(new Response(fixture("api/hn-front-page.json"))).impl,
      now,
    });
    expect(result.error).toMatch(/boom from storage/);
    const row = await source(hn);
    expect(row.consecutive_failures).toBe(1);
    expect(row.last_error).toMatch(/boom from storage/);
  });

  test("success resets the failure counter", async () => {
    await ingestSource(hn, deps(new Response("down", { status: 500 })));
    await ingestSource(
      hn,
      deps(new Response(fixture("api/hn-front-page.json"))),
    );
    const row = await source(hn);
    expect(row.consecutive_failures).toBe(0);
    expect(row.last_error).toBeNull();
    expect(row.last_fetched_at).not.toBeNull();
  });

  test("304 records the fetch without items and keeps validators", async () => {
    const rss = await makeSource("rss");
    await ingestSource(
      rss,
      deps(
        new Response(fixture("feeds/rss2.xml"), {
          headers: { etag: 'W/"v1"' },
        }),
      ),
    );
    const result = await ingestSource(
      rss,
      deps(new Response(null, { status: 304 })),
    );
    expect(result).toMatchObject({ inserted: [], seen: 0 });
    expect((await source(rss)).etag).toBe('W/"v1"');
  });
});

describe("processItems", () => {
  test("accepts, rejects with a reason, and marks cross-source duplicates", async () => {
    const blog = await makeSource("rss");
    const hn = await makeSource("hn", { niche_specific: false });

    const blogRun = await ingestSource(
      blog,
      deps(new Response(fixture("feeds/rss2.xml"))),
    );
    const hnJson = JSON.stringify({
      hits: [
        {
          objectID: `dup-${hn}`,
          title: "Introducing Agents SDK 2.0 (example.com)",
          url: "https://www.blog.example.com/agents-sdk-2?utm_source=hn",
          author: "x",
          points: 50,
          num_comments: 5,
          created_at: "2026-11-02T09:00:00Z",
          story_text: null,
        },
        {
          objectID: `farm-${hn}`,
          title: "Senate passes new farm bill after long debate",
          url: `https://news.test/farm-${hn}`,
          author: "y",
          points: 300,
          num_comments: 400,
          created_at: "2026-11-02T09:00:00Z",
          story_text: null,
        },
      ],
    });
    const hnRun = await ingestSource(hn, deps(new Response(hnJson)));

    const first = await processItems([...blogRun.inserted, ...hnRun.inserted], {
      db,
      now,
    });
    // blog: "Agents SDK" accepted, "Second post" too short; hn: one duplicate, one off-niche
    expect(first).toEqual({ accepted: 1, rejected: 2, duplicate: 1 });

    const [dup, farm] = await items(hn);
    const [root, short] = await items(blog);
    expect(short).toMatchObject({
      filter_status: "rejected",
      reject_reason: "too_short",
    });
    expect(dup).toMatchObject({
      filter_status: "duplicate",
      duplicate_of: root.id,
    });
    expect(farm).toMatchObject({
      filter_status: "rejected",
      reject_reason: "off_niche",
    });
    expect(root.filter_status).toBe("accepted");
    expect(root.raw_metadata).toMatchObject({
      pre_category: expect.any(String),
    });

    const again = await processItems([...blogRun.inserted, ...hnRun.inserted], {
      db,
      now,
    });
    expect(again).toEqual({ accepted: 0, rejected: 0, duplicate: 0 });
  });
});

test("processItems accepts thousands of ids (no oversized request URLs)", async () => {
  const ids = Array.from({ length: 3000 }, (_, i) => 900_000_000 + i);
  await expect(processItems(ids, { db, now })).resolves.toEqual({
    accepted: 0,
    rejected: 0,
    duplicate: 0,
  });
});

test("allPendingItemIds pages past the 1000-row API limit", async () => {
  const hn = await makeSource("hn", { niche_specific: false });
  const hits = Array.from({ length: 1100 }, (_, i) => ({
    objectID: `page-${hn}-${i}`,
    title: `Paging story number ${i} about developer tools`,
    url: `https://paging.test/${hn}/${i}`,
    author: "a",
    points: 1,
    num_comments: 0,
    created_at: "2026-11-02T09:00:00Z",
    story_text: null,
  }));
  const run = await ingestSource(
    hn,
    deps(new Response(JSON.stringify({ hits }))),
  );
  const pending = new Set(await allPendingItemIds(db));
  expect(run.inserted.every((id) => pending.has(id))).toBe(true);
});

describe("refreshHnMetrics", () => {
  test("snapshots current points for recent HN items", async () => {
    const hn = await makeSource("hn", { niche_specific: false });
    await ingestSource(
      hn,
      deps(new Response(fixture("api/hn-front-page.json"))),
    );
    const [row] = await items(hn);
    const before = await metricCount(row.id);

    // Other HN rows in the database make the job batch several requests.
    const { impl, requests } = fakeFetchAlways(
      () => new Response(fixture("api/hn-front-page.json")),
    );
    const result = await refreshHnMetrics({ db, fetch: impl, now: new Date() });

    expect(requests.some((r) => r.url.includes("story_45810001"))).toBe(true);
    expect(result.snapshots).toBeGreaterThanOrEqual(2);
    expect(await metricCount(row.id)).toBe(before + 2);
  });
});
