import type { DiscoverFilters } from "./params";

/** /discover URL for the given filters; defaults are left out so URLs stay short and shareable. */
export function discoverHref(
  filters: Pick<DiscoverFilters, "range" | "category" | "q">,
  overrides: {
    range?: DiscoverFilters["range"];
    /** null clears the category */
    category?: DiscoverFilters["category"] | null;
    q?: string;
  } = {},
): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.range && next.range !== "today") params.set("range", next.range);
  if (next.category) params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  const query = params.toString();
  return query ? `/discover?${query}` : "/discover";
}
