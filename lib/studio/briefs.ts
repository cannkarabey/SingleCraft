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
