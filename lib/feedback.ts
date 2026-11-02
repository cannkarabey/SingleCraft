import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export const FEEDBACK_DAILY_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export const FeedbackInput = z.object({
  message: z.string().trim().min(1).max(2000),
  page: z.string().max(500).optional(),
});

/** Beta feedback (plan §9 Faz 9), written with the service role; 20 per user per day. */
export async function submitFeedback(
  admin: SupabaseClient<Database>,
  userId: string,
  input: z.input<typeof FeedbackInput>,
  now: Date = new Date(),
): Promise<"ok" | "limit"> {
  const { message, page } = FeedbackInput.parse(input);
  const { count, error } = await admin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("created_at", new Date(now.getTime() - DAY_MS).toISOString());
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= FEEDBACK_DAILY_LIMIT) return "limit";
  const { error: insertError } = await admin
    .from("feedback")
    .insert({ user_id: userId, message, page: page ?? null });
  if (insertError) throw new Error(insertError.message);
  return "ok";
}
