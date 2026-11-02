import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Published stories for e2e runs, created through the service role and removed afterwards.
// Titles carry a run tag so assertions never depend on other local data.

export const SEED_FILE = "test-results/e2e-seed.json";

export type Seed = {
  tag: string;
  sources: string[];
  stories: string[];
  top: { id: string; slug: string; title: string };
  devTool: { id: string; slug: string; title: string };
  old: { id: string; slug: string; title: string };
};

/**
 * "hours ago", clamped into the current UTC day unless `allowPastDays`: Discover's default
 * range is "today" (since 00:00 UTC), so runs just after midnight must still see the seed.
 */
export function seedTime(
  hoursAgo: number,
  now = new Date(),
  opts: { allowPastDays?: boolean } = {},
) {
  const t = now.getTime() - hoursAgo * 3600_000;
  if (opts.allowPastDays) return new Date(t).toISOString();
  const dayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  // Keep relative order inside the day: map into (dayStart, now).
  const clamped =
    t >= dayStart
      ? t
      : dayStart + ((now.getTime() - dayStart) * (1 - hoursAgo / 48)) / 2;
  return new Date(Math.min(clamped, now.getTime() - 1000)).toISOString();
}

function must<T>(
  result: { data: T; error: { message: string } | null },
  what: string,
): T {
  if (result.error)
    throw new Error(`e2e seed: ${what}: ${result.error.message}`);
  return result.data;
}

function admin() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
}

export async function seed(): Promise<Seed> {
  const db = admin();
  const tag = randomUUID().slice(0, 6);
  const now = new Date();
  const hours = (h: number) => seedTime(h, now);

  const sourceRows = ["hn", "github"].map((type) => ({
    id: randomUUID(),
    name: `e2e ${type} ${tag}`,
    type,
    url: `https://e2e.test/${type}/${tag}`,
    trust_weight: 0.8,
  }));
  const stories: string[] = [];
  // Written after every insert, so teardown can remove whatever a failed seed left behind.
  const record = (extra: Partial<Seed> = {}) =>
    writeFileSync(
      SEED_FILE,
      JSON.stringify({
        tag,
        sources: sourceRows.map((s) => s.id),
        stories,
        ...extra,
      }),
    );
  record();
  must(await db.from("sources").insert(sourceRows), "sources");

  async function story(
    title: string,
    fields: Record<string, unknown>,
    metric?: [string, number],
  ) {
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const { data, error } = await db
      .from("stories")
      .insert({
        status: "published",
        title,
        slug,
        summary: `${title}: a short factual summary of what happened.`,
        why_it_matters: `${title} matters for builders.`,
        entities: ["Acme"],
        suggested_angles: [
          "Hands-on review",
          "What changed",
          "Who should care",
        ],
        source_count: 1,
        trust_score: 0.8,
        ...fields,
      })
      .select("id")
      .single();
    if (error) throw error;
    stories.push(data.id);
    record();
    const source =
      metric?.[0] === "stars" ? sourceRows[1].id : sourceRows[0].id;
    const { data: item, error: itemError } = await db
      .from("raw_items")
      .insert({
        source_id: source,
        external_id: `${slug}`,
        url: `https://news.e2e.test/${slug}`,
        canonical_url: `https://news.e2e.test/${slug}`,
        title: `${title} (original report)`,
        content_hash: slug,
        filter_status: "accepted",
        published_at: hours(1),
      })
      .select("id")
      .single();
    if (itemError) throw itemError;
    must(
      await db
        .from("story_sources")
        .insert({ story_id: data.id, raw_item_id: item.id, source_id: source }),
      "story_sources",
    );
    if (metric) {
      must(
        await db
          .from("item_metrics")
          .insert({
            raw_item_id: item.id,
            metric: metric[0],
            value: metric[1],
          }),
        "item_metrics",
      );
    }
    const trend = await db.from("trend_scores").insert(
      [40, 55, 70, 90].map((value, i) => ({
        story_id: data.id,
        metric: "global",
        value,
        calculated_at: hours(4 - i),
      })),
    );
    must(trend, "trend_scores");
    return { id: data.id, slug, title };
  }

  const top = await story(
    `Quokka agent launch ${tag}`,
    {
      category: "ai_tools",
      global_score: 99_900,
      velocity_score: 950,
      is_early_signal: false,
      first_seen_at: hours(1),
    },
    ["points", 412],
  );
  const devTool = await story(
    `Wombat compiler release ${tag}`,
    {
      category: "developer_tools",
      global_score: 99_800,
      first_seen_at: hours(2),
    },
    ["stars", 999_999],
  );
  const old = await story(`Bilby breach report ${tag}`, {
    category: "security",
    global_score: 99_700,
    first_seen_at: seedTime(72, now, { allowPastDays: true }),
  });
  // Enough filler to need a second page (page size 20).
  for (let i = 0; i < 24; i++) {
    await story(`Numbat filler ${String(i).padStart(2, "0")} ${tag}`, {
      category: "ai_models",
      global_score: 99_000 - i,
      first_seen_at: hours(1),
    });
  }

  record({ top, devTool, old });
  return readSeed();
}

export function readSeed(): Seed {
  return JSON.parse(readFileSync(SEED_FILE, "utf8"));
}

export async function unseed() {
  if (!existsSync(SEED_FILE)) return;
  const { stories, sources } = readSeed();
  const db = admin();
  await db.from("stories").delete().in("id", stories);
  await db.from("sources").delete().in("id", sources);
}
