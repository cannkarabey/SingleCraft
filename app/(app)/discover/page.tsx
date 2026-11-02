import { getTranslations } from "next-intl/server";
import { CategoryNav } from "@/components/discover/CategoryNav";
import { LoadMore } from "@/components/discover/LoadMore";
import { RangeTabs } from "@/components/discover/RangeTabs";
import { SearchBox } from "@/components/discover/SearchBox";
import { SidePanels } from "@/components/discover/SidePanels";
import { StoryCard } from "@/components/story/StoryCard";
import { currentUser } from "@/lib/auth/session";
import {
  parseDiscoverQuery,
  type DiscoverFilters,
} from "@/lib/discover/params";
import {
  categoryCounts,
  githubPanel,
  listStories,
  newToolsPanel,
  trendingPanel,
} from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const DEFAULTS: DiscoverFilters = { range: "today", limit: 20 };

export default async function DiscoverPage({
  searchParams,
}: PageProps<"/discover">) {
  const parsed = parseDiscoverQuery(await searchParams);
  // Bad query strings fall back to the defaults instead of an error page.
  const filters: DiscoverFilters = parsed.ok
    ? { ...parsed.filters, cursor: undefined, limit: 20 }
    : DEFAULTS;
  const db = createPublicClient();
  const now = new Date();

  const [t, page, counts, trending, newTools, github, user] = await Promise.all(
    [
      getTranslations("discover"),
      listStories(db, { ...filters, now }),
      categoryCounts(db, { range: filters.range, now }),
      trendingPanel(db, now),
      newToolsPanel(db, now),
      githubPanel(db, now),
      currentUser(),
    ],
  );

  const query = {
    range: filters.range,
    category: filters.category,
    q: filters.q,
  };
  const filtered = Boolean(
    filters.category || filters.q || filters.range !== "today",
  );

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:grid-cols-[13rem_1fr] lg:grid-cols-[13rem_1fr_16rem]">
      <aside className="min-w-0 md:sticky md:top-20 md:self-start">
        <CategoryNav filters={filters} counts={counts} />
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <RangeTabs filters={filters} />
        </div>
        <SearchBox
          defaultValue={filters.q}
          hidden={{
            range: filters.range === "today" ? undefined : filters.range,
            category: filters.category,
          }}
        />

        {page.items.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-lg border p-6">
            {filtered ? t("noResults") : t("empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {page.items.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                now={now}
                signedIn={Boolean(user)}
              />
            ))}
            {/* Keyed by filters: a new filter set must not keep pages loaded for the old one. */}
            <LoadMore
              key={JSON.stringify(query)}
              query={query}
              initialCursor={page.nextCursor}
            />
          </div>
        )}
      </section>

      <aside className="min-w-0 md:col-start-2 lg:col-start-3 lg:row-start-1">
        <SidePanels trending={trending} newTools={newTools} github={github} />
      </aside>
    </main>
  );
}
