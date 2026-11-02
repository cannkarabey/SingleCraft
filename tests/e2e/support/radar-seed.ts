import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

export type RadarSeedStory = { id: string; title: string };

/**
 * Published stories for Radar tests. Each title carries the run tag plus topic words so a
 * niche with keywords [tag, topic] matches exactly the intended stories.
 */
export async function seedRadarStories(
  specs: {
    topic: string;
    title: string;
    velocity?: number;
    engagement?: number;
    early?: boolean;
  }[],
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
      await db
        .from("stories")
        .delete()
        .in(
          "id",
          stories.map((s) => s.id),
        );
    },
  };
}

/** Creates the signed-in user's niche directly (onboarding is tested separately). */
export async function nicheFor(
  email: string,
  niche: { name: string; keywords: string[]; excluded_keywords?: string[] },
) {
  const db = admin();
  const userId = await userIdByEmail(email);
  const { error } = await db
    .from("niches")
    .insert({ user_id: userId, ...niche });
  if (error) throw error;
  return userId;
}

export async function setPlan(userId: string, plan: "free" | "creator") {
  await admin().from("profiles").update({ plan }).eq("id", userId);
}

/** Pages through auth users until the email is found (listUsers caps a page at 1000). */
export async function userIdByEmail(email: string): Promise<string> {
  const db = admin();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < 1000) throw new Error(`no user ${email}`);
  }
}

/** Deletes every user created by e2e sign-ins (emails e2e-…@test.dev). */
export async function deleteE2eUsers() {
  const db = admin();
  const doomed: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    doomed.push(
      ...data.users
        .filter((u) => /^e2e-.*@test\.dev$/.test(u.email ?? ""))
        .map((u) => u.id),
    );
    if (data.users.length < 1000) break;
  }
  for (const id of doomed) await db.auth.admin.deleteUser(id);
}
