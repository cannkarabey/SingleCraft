import type { SupabaseClient } from "@supabase/supabase-js";
import { capture } from "@/lib/analytics/server";
import { limitsFor } from "@/lib/billing/limits";
import type { DigestStory } from "@/emails/DailyDigest";
import type { Database } from "@/lib/supabase/types";
import { claimEmail, confirmEmail, releaseEmail } from "./claims";
import { renderDigest } from "./render";
import type { OutgoingEmail } from "./transport";
import { unsubscribeHeaders, unsubscribeUrl } from "./unsubscribe";

type Db = SupabaseClient<Database>;
type Send = (mail: OutgoingEmail) => Promise<{ id: string }>;

const DIGEST_SIZE = 5;
const DAY_MS = 24 * 3600_000;

/** Top stories for the digest: the first niche's Radar, else Discover's best of 24 h. */
async function digestStories(
  db: Db,
  userId: string,
  now: Date,
): Promise<DigestStory[]> {
  const { data: niche } = await db
    .from("niches")
    .select("id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (niche) {
    const { data, error } = await db.rpc("radar_feed", {
      p_niche: niche.id,
      p_user: userId,
    });
    if (error) throw new Error(error.message);
    if (data.length > 0) {
      return data.slice(0, DIGEST_SIZE).map((r) => ({
        id: r.story_id,
        title: r.title,
        summary: r.summary,
        slug: r.slug,
      }));
    }
  }
  const { data, error } = await db
    .from("stories")
    .select("id, title, summary, slug")
    .eq("status", "published")
    .gte("first_seen_at", new Date(now.getTime() - DAY_MS).toISOString())
    .order("global_score", { ascending: false })
    .limit(DIGEST_SIZE);
  if (error) throw new Error(error.message);
  return data;
}

/** Yesterday's newest ready, unpublished brief → "Yayınladın mı?" (plan §1 #9). */
async function publishCheck(db: Db, userId: string, now: Date) {
  const { data } = await db
    .from("briefs")
    .select("id, stories(title)")
    .eq("user_id", userId)
    .eq("status", "ready")
    .is("published_at", null)
    .gte("created_at", new Date(now.getTime() - 2 * DAY_MS).toISOString())
    .lt("created_at", new Date(now.getTime() - DAY_MS / 2).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { briefId: data.id, storyTitle: data.stories?.title ?? null }
    : null;
}

/**
 * send-digest (plan §7): every user whose local hour is their digest hour, on a plan with
 * the digest, gets one email per local day. Claimed in email_log before sending.
 */
export async function sendDigests(deps: {
  db: Db;
  now: Date;
  send: Send;
  appUrl: string;
}) {
  const result = { sent: 0, skipped: 0, failed: 0 };
  const { data: due, error } = await deps.db.rpc("digest_due_users", {
    p_now: deps.now.toISOString(),
  });
  if (error) throw new Error(error.message);

  const plans = new Map<string, string>();
  if (due.length) {
    const { data: profiles } = await deps.db
      .from("profiles")
      .select("id, plan")
      .in(
        "id",
        due.map((d) => d.user_id),
      );
    for (const p of profiles ?? []) plans.set(p.id, p.plan);
  }

  for (const user of due) {
    if (!limitsFor(plans.get(user.user_id)).digest) {
      result.skipped++;
      continue;
    }
    const claim = await claimEmail(deps.db, {
      user_id: user.user_id,
      kind: "digest",
      day: user.local_day,
    });
    if (claim === null) {
      result.skipped++;
      continue;
    }
    try {
      const stories = await digestStories(deps.db, user.user_id, deps.now);
      if (stories.length === 0) {
        result.skipped++;
        continue; // keep the claim: nothing to send today
      }
      const unsubscribe = unsubscribeUrl(deps.appUrl, user.user_id, "digest");
      const mail = await renderDigest({
        locale: user.locale === "en" ? "en" : "tr",
        appUrl: deps.appUrl,
        unsubscribeUrl: unsubscribe,
        stories,
        publishCheck: await publishCheck(deps.db, user.user_id, deps.now),
      });
      const sent = await deps.send({
        to: user.email,
        ...mail,
        headers: unsubscribeHeaders(unsubscribe),
      });
      await confirmEmail(deps.db, claim, sent.id);
      result.sent++;
      // Denominator of the digest open rate (plan §10).
      await capture({
        event: "digest_sent",
        distinctId: user.user_id,
        properties: { stories: stories.length },
      });
    } catch (sendError) {
      await releaseEmail(deps.db, claim);
      console.warn(
        `digest for ${user.user_id} failed:`,
        sendError instanceof Error ? sendError.message : sendError,
      );
      result.failed++;
    }
  }
  return result;
}
