import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function admin() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export type RadarSeedStory = { id: string; title: string };

/**
 * Published stories for Radar tests. Each title carries the run tag plus topic words so a
 * niche with keywords [tag, topic] matches exactly the intended stories.
 */
export async function seedRadarStories(
  specs: { topic: string; title: string; velocity?: number; engagement?: number; early?: boolean }[],
) {
  const db = admin();
  const tag = `qx${randomUUID().slice(0, 6)}`;
  const stories: RadarSeedStory[] = [];
  for (const spec of specs) {
    const title = `${spec.title} ${spec.topic} ${tag}`;
    const { data, error } = await db
      .from("stories")
      .insert({
        status: "published",
        title,
        summary: `${title} summary`,
        why_it_matters: `${spec.topic} creators should care.`,
        velocity_score: spec.velocity ?? 90,
        engagement_score: spec.engagement ?? 40,
        source_diversity_score: 50,
        freshness_score: 100,
        trust_score: 1,
        is_early_signal: spec.early ?? false,
        global_score: 80,
        source_count: 2,
        first_seen_at: new Date(Date.now() - 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    stories.push({ id: data.id, title });
  }
  return {
    tag,
    stories,
    cleanup: async () => {
      await db.from("stories").delete().in("id", stories.map((s) => s.id));
    },
  };
}

/** Creates the signed-in user's niche directly (onboarding is tested separately). */
export async function nicheFor(email: string, niche: { name: string; keywords: string[]; excluded_keywords?: string[] }) {
  const db = admin();
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`no user ${email}`);
  const { error } = await db.from("niches").insert({ user_id: user.id, ...niche });
  if (error) throw error;
  return user.id;
}

export async function setPlan(userId: string, plan: "free" | "creator") {
  await admin().from("profiles").update({ plan }).eq("id", userId);
}
