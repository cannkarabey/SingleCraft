import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { claimEmail, confirmEmail, localDay, releaseEmail } from "./claims";
import { renderAlert } from "./render";
import type { OutgoingEmail } from "./transport";
import { unsubscribeHeaders, unsubscribeUrl } from "./unsubscribe";

type Db = SupabaseClient<Database>;
type Send = (mail: OutgoingEmail) => Promise<{ id: string }>;

/** At most this many alert emails per user per local day (plan §9 Faz 7). */
export const MAX_ALERTS_PER_DAY = 3;

/**
 * check-alerts (plan §7): stories whose Radar score reaches a niche's alert threshold are
 * emailed once per user and story, at most 3 a day.
 */
export async function checkAlerts(deps: {
  db: Db;
  now: Date;
  send: Send;
  appUrl: string;
}) {
  const result = { sent: 0, skipped: 0, failed: 0 };
  const { data: niches, error } = await deps.db
    .from("niches")
    .select(
      "id, name, user_id, alert_threshold, profiles!niches_user_id_fkey!inner(alerts_enabled, timezone, locale)",
    )
    .eq("profiles.alerts_enabled", true);
  if (error) throw new Error(error.message);

  const emails = new Map<string, string | null>();
  for (const niche of niches) {
    const profile = niche.profiles;
    const day = localDay(deps.now, profile.timezone);

    const { count } = await deps.db
      .from("email_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", niche.user_id)
      .eq("kind", "alert")
      .eq("day", day);
    let remaining = MAX_ALERTS_PER_DAY - (count ?? 0);
    if (remaining <= 0) continue;

    const { data: feed, error: feedError } = await deps.db.rpc("radar_feed", {
      p_niche: niche.id,
      p_user: niche.user_id,
    });
    if (feedError) throw new Error(feedError.message);
    const hits = feed.filter((r) => r.final_score >= niche.alert_threshold);
    if (hits.length === 0) continue;

    if (!emails.has(niche.user_id)) {
      const { data } = await deps.db.auth.admin.getUserById(niche.user_id);
      emails.set(niche.user_id, data.user?.email ?? null);
    }
    const to = emails.get(niche.user_id);
    if (!to) continue;

    for (const story of hits) {
      if (remaining <= 0) break;
      const claim = await claimEmail(deps.db, {
        user_id: niche.user_id,
        kind: "alert",
        day,
        story_id: story.story_id,
      });
      if (claim === null) {
        result.skipped++;
        continue;
      }
      try {
        const unsubscribe = unsubscribeUrl(
          deps.appUrl,
          niche.user_id,
          "alerts",
        );
        const mail = await renderAlert({
          locale: profile.locale === "en" ? "en" : "tr",
          appUrl: deps.appUrl,
          unsubscribeUrl: unsubscribe,
          nicheName: niche.name,
          story: {
            id: story.story_id,
            title: story.title,
            summary: story.summary,
            slug: story.slug,
            score: story.final_score,
          },
        });
        const sent = await deps.send({
          to,
          ...mail,
          headers: unsubscribeHeaders(unsubscribe),
        });
        await confirmEmail(deps.db, claim, sent.id);
        remaining--;
        result.sent++;
      } catch (sendError) {
        await releaseEmail(deps.db, claim);
        console.warn(
          `alert for ${niche.user_id} failed:`,
          sendError instanceof Error ? sendError.message : sendError,
        );
        result.failed++;
      }
    }
  }
  return result;
}
