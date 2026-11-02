import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { discoverHref } from "@/lib/discover/href";
import type { DiscoverFilters } from "@/lib/discover/params";
import { CATEGORIES, type StoryCategory } from "@/lib/discover/queries";
import { cn } from "@/lib/utils";

/** Category list with counts; vertical on desktop, horizontal chips on mobile. */
export async function CategoryNav({
  filters,
  counts,
}: {
  filters: DiscoverFilters;
  counts: Partial<Record<StoryCategory, number>>;
}) {
  const t = await getTranslations("discover");
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const items: { key: StoryCategory | null; label: string; count: number }[] = [
    { key: null, label: t("categories.all"), count: total },
    ...CATEGORIES.map((c) => ({
      key: c,
      label: t(`categories.${c}`),
      count: counts[c] ?? 0,
    })),
  ];
  return (
    <nav aria-label={t("categoriesLabel")}>
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {items.map(({ key, label, count }) => {
          const active = (filters.category ?? null) === key;
          return (
            <li key={key ?? "all"} className="shrink-0">
              <Link
                href={discoverHref(filters, { category: key })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-sm transition-colors duration-150 md:border-transparent",
                  active
                    ? "border-border bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="whitespace-nowrap">{label}</span>
                <span className="font-mono text-xs">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
