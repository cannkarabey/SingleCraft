import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { relativeTime, signalLevel } from "@/lib/discover/format";
import type { StoryCard as StoryCardData } from "@/lib/discover/queries";
import { PlatformSignals } from "./PlatformSignals";
import { SignalBar } from "./SignalBar";
import { StoryActions } from "./StoryActions";

export async function StoryCard({
  story,
  now,
  actions = true,
}: {
  story: StoryCardData;
  now: Date;
  actions?: boolean;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("discover"),
    getLocale(),
  ]);
  const href = `/discover/${story.slug ?? story.id}`;

  return (
    <article className="bg-card flex gap-3 rounded-lg border p-4 transition-colors duration-150 hover:border-white/15">
      <SignalBar level={signalLevel(story)} />
      <div className="min-w-0 flex-1 space-y-2">
        {story.category && (
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t(`categories.${story.category}`)}
          </p>
        )}
        <h3 className="text-lg leading-snug font-semibold tracking-tight">
          <Link href={href} className="hover:underline">
            {story.title}
          </Link>
        </h3>
        {story.summary && (
          <p className="text-muted-foreground">{story.summary}</p>
        )}
        <p className="text-muted-foreground font-mono text-xs">
          {relativeTime(story.first_seen_at, now, locale)} ·{" "}
          {t("meta.sources", { count: story.source_count })} ·{" "}
          {t("meta.velocity", { value: Math.round(story.velocity_score) })}
        </p>
        <PlatformSignals signals={story.signals} />
        {story.why_it_matters && (
          <details className="group text-sm">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
              {t("whyItMatters")}
            </summary>
            <p className="mt-2">{story.why_it_matters}</p>
          </details>
        )}
        {actions && <StoryActions storyId={story.slug ?? story.id} />}
      </div>
    </article>
  );
}
