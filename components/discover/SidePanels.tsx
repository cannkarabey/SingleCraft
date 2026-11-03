import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { compactNumber } from "@/lib/discover/format";
import type { PanelItem } from "@/lib/discover/queries";

function Panel({
  title,
  items,
  empty,
  locale,
}: {
  title: string;
  items: PanelItem[];
  empty: string;
  locale: string;
}) {
  return (
    <section className="bg-surface-1 rounded-lg border p-4">
      <h2 className="text-[13px] font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-[13px]">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 text-[13px]"
            >
              <Link
                href={`/discover/${item.slug ?? item.id}`}
                className="text-muted-foreground hover:text-foreground line-clamp-2"
              >
                {item.title}
              </Link>
              <span className="text-text-tertiary shrink-0 font-mono text-xs">
                {compactNumber(Math.round(item.value), locale)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export async function SidePanels({
  trending,
  newTools,
  github,
}: {
  trending: PanelItem[];
  newTools: PanelItem[];
  github: PanelItem[];
}) {
  const [t, locale] = await Promise.all([
    getTranslations("discover.panels"),
    getLocale(),
  ]);
  return (
    <div className="space-y-4">
      <Panel
        title={t("trending")}
        items={trending}
        empty={t("empty")}
        locale={locale}
      />
      <Panel
        title={t("newTools")}
        items={newTools}
        empty={t("empty")}
        locale={locale}
      />
      <Panel
        title={t("github")}
        items={github}
        empty={t("empty")}
        locale={locale}
      />
    </div>
  );
}
