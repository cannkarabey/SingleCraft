import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

/** Editor autosave body: the user's edited copy and chosen hook (client-writable columns). */
export const EditInput = z.object({
  edited: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 100_000, "too large"),
  selected_hook: z.number().int().min(0).max(9).nullable(),
});

/** Saves through the user's client (RLS + column grants). false = not their brief. */
export async function saveEdits(
  userDb: Db,
  briefId: string,
  input: z.input<typeof EditInput>,
) {
  const { edited, selected_hook } = EditInput.parse(input);
  const { data, error } = await userDb
    .from("briefs")
    .update({ edited: edited as Json, selected_hook })
    .eq("id", briefId)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

export const PublishInput = z.object({
  url: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .nullable()
    .optional(),
});

/** "Yayınladım" (plan §1 #9): the north-star metric. */
export async function publishBrief(
  userDb: Db,
  briefId: string,
  url: string | null,
) {
  const { url: publishedUrl } = PublishInput.parse({ url });
  const { data, error } = await userDb
    .from("briefs")
    .update({
      published_at: new Date().toISOString(),
      published_url: publishedUrl ?? null,
    })
    .eq("id", briefId)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

const BRIEF_FIELDS =
  "id, story_id, niche_id, platform, format, tone, audience, length, user_take, status, output, edited, selected_hook, published_at, published_url, error, created_at, updated_at, stories(title, slug)";

/** One brief of the caller (RLS), with its versions newest first. */
export async function getBrief(userDb: Db, briefId: string) {
  const { data, error } = await userDb
    .from("briefs")
    .select(BRIEF_FIELDS)
    .eq("id", briefId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: versions, error: versionsError } = await userDb
    .from("brief_versions")
    .select("id, output, created_at")
    .eq("brief_id", briefId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (versionsError) throw new Error(versionsError.message);
  return { ...data, versions };
}

export type BriefDetail = NonNullable<Awaited<ReturnType<typeof getBrief>>>;

/** The idea pool (plan §8.2 /studio): newest first, optionally only published/draft. */
export async function listBriefs(userDb: Db, filter?: "published" | "draft") {
  let query = userDb
    .from("briefs")
    .select(
      "id, status, platform, format, created_at, published_at, stories(title)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "published") query = query.not("published_at", "is", null);
  if (filter === "draft") query = query.is("published_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
