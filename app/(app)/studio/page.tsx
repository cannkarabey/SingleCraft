import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { relativeTime } from "@/lib/discover/format";
import { listBriefs } from "@/lib/studio/briefs";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const FILTERS = [undefined, "published", "draft"] as const;

/** The idea pool (plan §8.2): saved briefs with status and a published filter. */
export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  const raw = (await searchParams).status;
  const filter = raw === "published" || raw === "draft" ? raw : undefined;
  const [briefs, t, locale] = await Promise.all([
    listBriefs(await createClient(), filter),
    getTranslations("studio"),
    getLocale(),
  ]);
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <nav aria-label={t("filters.label")} className="flex gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f ?? "all"}
            href={f ? `/studio?status=${f}` : "/studio"}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm",
              f === filter
                ? "bg-surface-2"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`filters.${f ?? "all"}`)}
          </Link>
        ))}
      </nav>
      {briefs.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-lg border p-6">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {briefs.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <Link
                href={`/studio/${b.id}`}
                className="font-medium hover:underline"
              >
                {b.stories?.title ?? b.id}
              </Link>
              <span className="text-muted-foreground font-mono text-xs">
                {t(
                  `controls.platforms.${b.platform}` as "controls.platforms.x",
                )}{" "}
                ·{" "}
                {b.published_at ? t("list.published") : t(`status.${b.status}`)}{" "}
                · {relativeTime(b.created_at, now, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
