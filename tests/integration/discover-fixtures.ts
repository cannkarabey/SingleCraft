import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cleanup, db, makeItem, makeSource } from "./helpers";

/** Anonymous client: what a signed-out visitor's requests can see under RLS. */
export const anon = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

export type Fixture = Awaited<ReturnType<typeof seedDiscover>>;

/** Published stories with distinctive titles and very high scores so they lead every list. */
export async function seedDiscover(now = new Date()) {
  const sources: string[] = [];
  const tag = randomUUID().slice(0, 8);
  const hn = await makeSource(sources, "hn");
  const gh = await makeSource(sources, "github");
  const hours = (h: number) =>
    new Date(now.getTime() - h * 3600_000).toISOString();

  async function story(
    title: string,
    fields: Record<string, unknown>,
    items: { source: string; points?: number; stars?: number }[] = [],
  ) {
    const { data, error } = await db
      .from("stories")
      .insert({
        status: "published",
        title,
        summary: `${title} summary`,
        why_it_matters: `${title} matters`,
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${tag}`,
        source_count: Math.max(1, items.length),
        ...fields,
      })
      .select("id, slug")
      .single();
    if (error) throw error;
    for (const item of items) {
      const id = await makeItem(item.source, `${title} item`, {
        content_text: "SECRET FULL TEXT",
      });
      await db
        .from("story_sources")
        .insert({ story_id: data.id, raw_item_id: id, source_id: item.source });
      const metrics = [
        ...(item.points
          ? [{ raw_item_id: id, metric: "points", value: item.points }]
          : []),
        ...(item.stars
          ? [{ raw_item_id: id, metric: "stars", value: item.stars }]
          : []),
      ].map((m) => ({ ...m, captured_at: now.toISOString() }));
      if (metrics.length) await db.from("item_metrics").insert(metrics);
    }
    return data;
  }

  const top = await story(
    `Quokka agents ${tag}`,
    {
      category: "ai_tools",
      global_score: 9900,
      velocity_score: 1000,
      first_seen_at: hours(2),
    },
    [{ source: hn, points: 412 }],
  );
  const second = await story(
    `Wombat compiler ${tag}`,
    {
      category: "developer_tools",
      global_score: 9800,
      first_seen_at: hours(5),
    },
    [{ source: gh, stars: 999_999 }],
  );
  const third = await story(`Numbat models ${tag}`, {
    category: "ai_models",
    global_score: 9700,
    first_seen_at: hours(10),
  });
  const old = await story(`Bilby security ${tag}`, {
    category: "security",
    global_score: 9600,
    first_seen_at: hours(72),
  });
  const pending = await story(`Dingo pending ${tag}`, {
    status: "pending",
    global_score: 9999,
    first_seen_at: hours(1),
  });

  return {
    tag,
    top,
    second,
    third,
    old,
    pending,
    ids: [top.id, second.id, third.id, old.id, pending.id],
    cleanup: async () => {
      await db
        .from("stories")
        .delete()
        .in("id", [top.id, second.id, third.id, old.id, pending.id]);
      await cleanup(sources);
    },
  };
}
