import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RadarRow } from "@/components/radar/RadarRow";
import { currentUser } from "@/lib/auth/session";
import { getRadar, type RadarRow as Row } from "@/lib/radar/feed";
import { listNiches } from "@/lib/radar/niches";
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
    getRadar(db, { nicheId: niche.id, plan: profile?.plan ?? null }),
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

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Link
          href={`/radar/settings?niche=${niche.id}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {t("settings")}
        </Link>
      </div>

      {niches.length > 1 && (
        <nav aria-label={t("niches")} className="flex flex-wrap gap-1.5">
          {niches.map((n) => (
            <Link
              key={n.id}
              href={`/radar?niche=${n.id}`}
              aria-current={n.id === niche.id ? "page" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm",
                n.id === niche.id
                  ? "bg-surface-2"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n.name}
            </Link>
          ))}
        </nav>
      )}

      {sections.map(({ key, rows }) => (
        <section
          key={key}
          aria-labelledby={`radar-${key}`}
          className="space-y-3"
        >
          <h2 id={`radar-${key}`} className="text-lg font-semibold">
            {t(`sections.${key}.title`)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(`sections.${key}.hint`)}
          </p>
          {rows.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {t("emptySection")}
            </p>
          ) : (
            rows.map((row, i) => (
              <RadarRow
                key={row.locked ? `locked-${key}-${i}` : row.story_id}
                row={row}
                trend={row.locked ? [] : (trends.get(row.story_id) ?? [])}
              />
            ))
          )}
        </section>
      ))}
    </main>
  );
}
