import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { limitsFor } from "@/lib/billing/limits";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

export const PLATFORMS = ["x", "linkedin", "youtube", "newsletter"] as const;
export const TONES = [
  "technical",
  "analytical",
  "fun",
  "contrarian",
  "plain",
] as const;

const term = z.string().trim().min(1).max(40);

/** Niche form/API input (plan §4 niches, §8.2 onboarding). */
export const NicheInput = z.object({
  name: z.string().trim().min(1).max(60),
  keywords: z.array(term).max(20).default([]),
  excluded_keywords: z.array(term).max(20).default([]),
  platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length).default([]),
  tone: z.enum(TONES).default("analytical"),
  language: z.enum(["tr", "en"]).default("tr"),
  tracked_channels: z
    .array(z.string().trim().min(1).max(100))
    .max(20)
    .default([]),
  voice_samples: z.array(z.string().trim().min(1).max(2000)).max(3).default([]),
  alert_threshold: z.number().int().min(0).max(100).optional(),
});
export type NicheInput = z.input<typeof NicheInput>;

/** Lower-cased, trimmed, de-duplicated terms (matching in radar_feed is case-insensitive). */
function terms(values: string[]): string[] {
  return [
    ...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)),
  ];
}

function normalize(input: NicheInput) {
  const n = NicheInput.parse(input);
  return {
    ...n,
    keywords: terms(n.keywords),
    excluded_keywords: terms(n.excluded_keywords),
    platforms: [...new Set(n.platforms)],
  };
}

/**
 * Creates a niche with the service-role client after the plan's niche limit is checked
 * (clients cannot insert niches directly, Faz 1 ruling). Marks the user onboarded.
 */
export async function createNiche({
  admin,
  userId,
  input,
}: {
  admin: Db;
  userId: string;
  input: NicheInput;
}): Promise<
  | { ok: true; niche: Database["public"]["Tables"]["niches"]["Row"] }
  | { ok: false; error: "limit" }
> {
  const [{ data: profile, error: profileError }, { count, error: countError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("plan, onboarded_at")
        .eq("id", userId)
        .single(),
      admin
        .from("niches")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
  if (profileError) throw new Error(profileError.message);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= limitsFor(profile.plan).niches)
    return { ok: false, error: "limit" };

  const { data: niche, error } = await admin
    .from("niches")
    .insert({ ...normalize(input), user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (!profile.onboarded_at) {
    await admin
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", userId);
  }
  return { ok: true, niche };
}

/** Updates through the user's own client: RLS limits it to their niches. null = not theirs. */
export async function updateNiche(userDb: Db, id: string, input: NicheInput) {
  const { data, error } = await userDb
    .from("niches")
    .update(normalize(input))
    .eq("id", id)
    .select("*");
  if (error) throw new Error(error.message);
  return data[0] ?? null;
}

export async function listNiches(userDb: Db) {
  const { data, error } = await userDb
    .from("niches")
    .select(
      "id, name, keywords, excluded_keywords, platforms, tone, language, tracked_channels, voice_samples, alert_threshold, created_at",
    )
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}
