import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { discoverHref } from "@/lib/discover/href";
import type { DiscoverFilters } from "@/lib/discover/params";
import { CATEGORIES, type StoryCategory } from "@/lib/discover/queries";
import { cn } from "@/lib/utils";

/** Category filter chips with counts, one scrollable row under the page header. */
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
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {items.map(({ key, label, count }) => {
          const active = (filters.category ?? null) === key;
          return (
            <li key={key ?? "all"} className="shrink-0">
              <Link
                href={discoverHref(filters, { category: key })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors duration-150",
                  active
                    ? "border-border-strong bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground border-transparent",
                )}
              >
                <span className="whitespace-nowrap">{label}</span>
                <span className="text-text-tertiary font-mono text-xs">
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
