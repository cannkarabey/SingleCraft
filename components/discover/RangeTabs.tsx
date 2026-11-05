import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { discoverHref } from "@/lib/discover/href";
import type { DiscoverFilters } from "@/lib/discover/params";
import { RANGES } from "@/lib/discover/queries";
import { cn } from "@/lib/utils";

export async function RangeTabs({ filters }: { filters: DiscoverFilters }) {
  const t = await getTranslations("discover");
  return (
    <nav
      aria-label={t("rangeLabel")}
      className="bg-surface-2 flex gap-0.5 rounded-md border p-0.5"
    >
      {RANGES.map((range) => (
        <Link
          key={range}
          href={discoverHref(filters, { range })}
          aria-current={filters.range === range ? "page" : undefined}
          className={cn(
            "rounded-[5px] px-2.5 py-1 text-[16.25px] whitespace-nowrap transition-colors duration-150",
            filters.range === range
              ? "bg-surface-3 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`ranges.${range}`)}
        </Link>
      ))}
    </nav>
  );
}
