"use server";

import { StoryCard } from "@/components/story/StoryCard";
import { parseDiscoverQuery } from "@/lib/discover/params";
import { listStories } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

/** Next page of Discover cards, rendered on the server (infinite scroll / "Load more"). */
export async function loadMoreStories(
  query: Record<string, string | undefined>,
) {
  const parsed = parseDiscoverQuery(query);
  if (!parsed.ok || !parsed.filters.cursor)
    return { nodes: [], nextCursor: null };
  const now = new Date();
  const { items, nextCursor } = await listStories(createPublicClient(), {
    ...parsed.filters,
    now,
  });
  return {
    nodes: items.map((story) => (
      <StoryCard key={story.id} story={story} now={now} />
    )),
    nextCursor,
  };
}
