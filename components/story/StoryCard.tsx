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
  headingLevel = 2,
  signedIn = false,
}: {
  story: StoryCardData;
  now: Date;
  actions?: boolean;
  /** 2 directly under a page h1 (Discover), 3 inside an h2 section (landing). */
  headingLevel?: 2 | 3;
  signedIn?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
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
        <Heading className="text-lg leading-snug font-semibold tracking-tight">
          <Link href={href} className="hover:underline">
            {story.title}
          </Link>
        </Heading>
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
        {actions && (
          <StoryActions
            storyId={story.slug ?? story.id}
            storyUuid={story.id}
            signedIn={signedIn}
          />
        )}
      </div>
    </article>
  );
}
