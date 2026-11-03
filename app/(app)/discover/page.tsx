import { getTranslations } from "next-intl/server";
import { CategoryNav } from "@/components/discover/CategoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
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
  const search = await searchParams;
  const parsed = parseDiscoverQuery(search);
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
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <RangeTabs filters={filters} />
            <SearchBox
              autoFocus={search.focus === "search"}
              defaultValue={filters.q}
              hidden={{
                range: filters.range === "today" ? undefined : filters.range,
                category: filters.category,
              }}
            />
          </>
        }
      >
        <CategoryNav filters={filters} counts={counts} />
      </PageHeader>

      <div className="grid flex-1 items-start gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0">
          {page.items.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border p-6">
              {filtered ? t("noResults") : t("empty")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {page.items.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  now={now}
                  signedIn={Boolean(user && !user.anonymous)}
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

        <aside className="min-w-0 xl:sticky xl:top-4">
          <SidePanels trending={trending} newTools={newTools} github={github} />
        </aside>
      </div>
    </main>
  );
}
