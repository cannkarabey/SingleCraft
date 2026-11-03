import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { RadarRow } from "@/components/radar/RadarRow";
import { currentUser } from "@/lib/auth/session";
import { getRadar, type RadarRow as Row } from "@/lib/radar/feed";
import { listNiches } from "@/lib/radar/niches";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function RadarPage({ searchParams }: PageProps<"/radar">) {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fradar");
  const db = await createClient();
  const [niches, { data: profile }] = await Promise.all([
    listNiches(db),
    db.from("profiles").select("plan").eq("id", user.id).single(),
  ]);
  if (niches.length === 0) redirect("/onboarding");

  const wanted = (await searchParams).niche;
  const niche = niches.find((n) => n.id === wanted) ?? niches[0];
  const [t, radar] = await Promise.all([
    getTranslations("radar"),
    getRadar({
      admin: createAdminClient(),
      userId: user.id,
      nicheId: niche.id,
      plan: profile?.plan ?? null,
    }),
  ]);

  // Sparkline data for visible rows (trend_scores is public for published stories).
  const openIds = [...radar.high, ...radar.early, ...radar.gaps]
    .filter((r): r is Extract<Row, { locked: false }> => !r.locked)
    .map((r) => r.story_id);
  const { data: trendRows } = openIds.length
    ? await db
        .from("trend_scores")
        .select("story_id, value, calculated_at")
        .in("story_id", openIds)
        .eq("metric", "global")
        .order("calculated_at", { ascending: true })
    : { data: [] };
  const trends = new Map<string, number[]>();
  for (const r of trendRows ?? [])
    trends.set(r.story_id, [...(trends.get(r.story_id) ?? []), r.value]);

  const sections: { key: "high" | "early" | "gaps"; rows: Row[] }[] = [
    { key: "high", rows: radar.high },
    { key: "early", rows: radar.early },
    { key: "gaps", rows: radar.gaps },
  ];

  const dot = { high: "bg-signal", early: "bg-warning", gaps: "bg-brand" };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href={`/radar/settings?niche=${niche.id}`}>
              {t("settings")}
            </Link>
          </Button>
        }
      >
        {niches.length > 1 && (
          <nav aria-label={t("niches")} className="flex flex-wrap gap-1">
            {niches.map((n) => (
              <Link
                key={n.id}
                href={`/radar?niche=${n.id}`}
                aria-current={n.id === niche.id ? "page" : undefined}
                className={cn(
                  "flex h-7 items-center rounded-md border px-2.5 text-[13px] transition-colors duration-150",
                  n.id === niche.id
                    ? "border-border-strong bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground border-transparent",
                )}
              >
                {n.name}
              </Link>
            ))}
          </nav>
        )}
      </PageHeader>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
        {sections.map(({ key, rows }) => (
          <section
            key={key}
            aria-labelledby={`radar-${key}`}
            className="overflow-hidden rounded-lg border"
          >
            <div className="bg-surface-2 flex h-9 items-center gap-2 px-4">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", dot[key])}
              />
              <h2 id={`radar-${key}`} className="text-[13px] font-medium">
                {t(`sections.${key}.title`)}
              </h2>
              <span
                data-testid="group-count"
                className="text-text-tertiary font-mono text-xs"
              >
                {rows.length}
              </span>
              <p className="text-text-tertiary ml-auto hidden truncate text-xs md:block">
                {t(`sections.${key}.hint`)}
              </p>
            </div>
            {rows.length === 0 ? (
              <p className="text-text-tertiary border-t px-4 py-3 text-[13px]">
                {t("emptySection")}
              </p>
            ) : (
              rows.map((row, i) => (
                <RadarRow
                  nicheId={niche.id}
                  key={row.locked ? `locked-${key}-${i}` : row.story_id}
                  row={row}
                  trend={row.locked ? [] : (trends.get(row.story_id) ?? [])}
                />
              ))
            )}
          </section>
        ))}

        <section
          aria-labelledby="radar-saved"
          className="overflow-hidden rounded-lg border"
        >
          <div className="bg-surface-2 flex h-9 items-center gap-2 px-4">
            <span
              aria-hidden
              className="bg-muted-foreground/50 size-2 rounded-full"
            />
            <h2 id="radar-saved" className="text-[13px] font-medium">
              {t("sections.saved.title")}
            </h2>
            <span className="text-text-tertiary font-mono text-xs">
              {radar.saved.length}
            </span>
          </div>
          {radar.saved.length === 0 ? (
            <p className="text-text-tertiary border-t px-4 py-3 text-[13px]">
              {t("sections.saved.empty")}
            </p>
          ) : (
            <ul>
              {radar.saved.map((story) => (
                <li key={story.id} className="border-t px-4 py-2.5">
                  <Link
                    href={`/discover/${story.slug ?? story.id}`}
                    className="line-clamp-1 text-[14px] font-medium hover:underline"
                  >
                    {story.title}
                  </Link>
                  {story.summary && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[13px]">
                      {story.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
