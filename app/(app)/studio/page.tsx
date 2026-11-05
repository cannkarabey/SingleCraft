import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/PageHeader";
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

  const dot: Record<string, string> = {
    queued: "bg-warning",
    generating: "bg-warning animate-pulse",
    ready: "bg-signal",
    failed: "bg-danger",
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("title")}>
        <nav aria-label={t("filters.label")} className="flex gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f ?? "all"}
              href={f ? `/studio?status=${f}` : "/studio"}
              aria-current={f === filter ? "page" : undefined}
              className={cn(
                "flex h-9 items-center rounded-md border px-2.5 text-[16.25px] transition-colors duration-150",
                f === filter
                  ? "border-border-strong bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground border-transparent",
              )}
            >
              {t(`filters.${f ?? "all"}`)}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <div className="p-4">
        {briefs.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border p-6">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {briefs.map((b) => (
              <li
                key={b.id}
                className="hover:bg-surface-2/50 flex items-center gap-3 px-4 py-2.5 transition-colors duration-150"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    b.published_at ? "bg-brand" : (dot[b.status] ?? "bg-muted"),
                  )}
                />
                <Link
                  href={`/studio/${b.id}`}
                  className="line-clamp-1 min-w-0 flex-1 text-[17.5px] font-medium hover:underline"
                >
                  {b.stories?.title ?? b.id}
                </Link>
                <span className="bg-surface-2 text-muted-foreground hidden shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-xs sm:inline">
                  {t(
                    `controls.platforms.${b.platform}` as "controls.platforms.x",
                  )}
                </span>
                <span className="text-text-tertiary shrink-0 font-mono text-xs">
                  {b.published_at
                    ? t("list.published")
                    : t(`status.${b.status}`)}{" "}
                  · {relativeTime(b.created_at, now, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
