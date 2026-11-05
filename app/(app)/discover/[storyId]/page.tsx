import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import { PlatformSignals } from "@/components/story/PlatformSignals";
import { ScoreBreakdown } from "@/components/story/ScoreBreakdown";
import { SignalBar } from "@/components/story/SignalBar";
import { SourceList } from "@/components/story/SourceList";
import { Sparkline } from "@/components/story/Sparkline";
import { StoryActions } from "@/components/story/StoryActions";
import { currentUser } from "@/lib/auth/session";
import { relativeTime, signalLevel } from "@/lib/discover/format";
import { getStory } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const MAX_ID_LENGTH = 200;

// Shared by generateMetadata and the page within one request.
const loadStory = cache(async (idOrSlug: string) =>
  idOrSlug.length > MAX_ID_LENGTH
    ? null
    : getStory(createPublicClient(), decodeURIComponent(idOrSlug)),
);

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

export async function generateMetadata({
  params,
}: PageProps<"/discover/[storyId]">): Promise<Metadata> {
  const story = await loadStory((await params).storyId);
  if (!story) return {};
  const title = story.title ?? "SignalCraft";
  const description = story.summary ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `/discover/${story.slug ?? story.id}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: story.first_seen_at,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function StoryPage({
  params,
}: PageProps<"/discover/[storyId]">) {
  const story = await loadStory((await params).storyId);
  if (!story) notFound();

  const [t, td, locale, user] = await Promise.all([
    getTranslations("story"),
    getTranslations("discover"),
    getLocale(),
    currentUser(),
  ]);
  const now = new Date();
  const entities = asStrings(story.entities);
  const angles = asStrings(story.suggested_angles);

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex h-12 items-center border-b px-4">
        <Link
          href="/discover"
          className="text-muted-foreground hover:text-foreground text-[16.25px] transition-colors duration-150"
        >
          ← {t("back")}
        </Link>
      </div>

      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8 p-4 sm:p-8">
          <header className="flex gap-3">
            <SignalBar level={signalLevel(story)} />
            <div className="min-w-0 space-y-3">
              {story.category && (
                <p className="text-text-tertiary font-mono text-xs tracking-wider uppercase">
                  {td(`categories.${story.category}`)}
                </p>
              )}
              <h1 className="text-3xl leading-[1.15] font-[590] tracking-[-0.02em] break-words">
                {story.title}
              </h1>
              <p className="text-text-tertiary font-mono text-xs">
                {t("firstSeen", {
                  time: relativeTime(story.first_seen_at, now, locale),
                })}{" "}
                · {td("meta.sources", { count: story.source_count })}
              </p>
              <PlatformSignals signals={story.signals} />
              {story.summary && (
                <p className="text-muted-foreground text-base">
                  {story.summary}
                </p>
              )}
              <StoryActions
                storyId={story.slug ?? story.id}
                storyUuid={story.id}
                signedIn={Boolean(user)}
              />
            </div>
          </header>

          {story.why_it_matters && (
            <section className="space-y-2">
              <h2 className="text-[16.25px] font-medium">
                {t("whyItMatters")}
              </h2>
              <p className="text-muted-foreground">{story.why_it_matters}</p>
            </section>
          )}

          {angles.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[16.25px] font-medium">{t("angles")}</h2>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                {angles.map((angle) => (
                  <li key={angle}>{angle}</li>
                ))}
              </ul>
            </section>
          )}

          {entities.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[16.25px] font-medium">{t("entities")}</h2>
              <ul className="flex flex-wrap gap-1.5">
                {entities.map((entity) => (
                  <li
                    key={entity}
                    className="bg-surface-2 rounded-md border px-2 py-0.5 text-[16.25px]"
                  >
                    {entity}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-8 border-t p-4 sm:p-6 lg:border-t-0 lg:border-l">
          <section className="space-y-3">
            <h2 className="text-[16.25px] font-medium">{t("scores")}</h2>
            <ScoreBreakdown scores={story} />
          </section>
          {story.trend.length > 1 && (
            <section className="space-y-3">
              <h2 className="text-[16.25px] font-medium">{t("trend")}</h2>
              <Sparkline
                values={story.trend.map((p) => p.value)}
                label={t("trend")}
              />
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-[16.25px] font-medium">{t("sources")}</h2>
            <SourceList sources={story.sources} now={now} />
          </section>
        </aside>
      </div>
    </main>
  );
}
