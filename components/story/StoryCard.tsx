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
    <article className="group hover:bg-surface-2/50 relative space-y-1.5 border-t px-4 py-3 transition-colors duration-150 first:border-t-0">
      <div className="flex items-start gap-3">
        <SignalBar
          level={signalLevel(story)}
          shape="dot"
          className="mt-[7px]"
        />
        <Heading className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-snug font-medium sm:line-clamp-1">
          <Link href={href} className="hover:underline">
            {story.title}
          </Link>
        </Heading>
        <span
          className="text-muted-foreground shrink-0 font-mono text-xs"
          title={t("meta.velocity", {
            value: Math.round(story.velocity_score),
          })}
        >
          {Math.round(story.global_score)}
        </span>
      </div>
      <div className="space-y-1.5 pl-5">
        {story.summary && (
          <p className="text-muted-foreground line-clamp-2 text-[13px]">
            {story.summary}
          </p>
        )}
        <p className="text-text-tertiary font-mono text-xs">
          {story.category && <>{t(`categories.${story.category}`)} · </>}
          {relativeTime(story.first_seen_at, now, locale)} ·{" "}
          {t("meta.sources", { count: story.source_count })} ·{" "}
          {t("meta.velocity", { value: Math.round(story.velocity_score) })}
        </p>
        <PlatformSignals signals={story.signals} />
        {story.why_it_matters && (
          <details className="group/why text-[13px]">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
              {t("whyItMatters")}
            </summary>
            <p className="mt-2">{story.why_it_matters}</p>
          </details>
        )}
        {actions && (
          <div className="pt-1 transition-opacity duration-150 md:absolute md:right-4 md:bottom-2.5 md:pt-0 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <StoryActions
              storyId={story.slug ?? story.id}
              storyUuid={story.id}
              signedIn={signedIn}
            />
          </div>
        )}
      </div>
    </article>
  );
}
