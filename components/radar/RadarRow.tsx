import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Sparkline } from "@/components/story/Sparkline";
import { Button } from "@/components/ui/button";
import type { RadarRow as Row } from "@/lib/radar/feed";
import { AngleButton } from "./AngleButton";
import { RadarActions } from "./RadarActions";

/** One Radar line (plan §8.2): title, score, trend, sources, why, angle, brief, save/hide. */
export async function RadarRow({
  row,
  trend,
  nicheId,
}: {
  row: Row;
  trend: number[];
  nicheId: string;
}) {
  const t = await getTranslations("radar");
  if (row.locked) {
    return (
      <div
        className="bg-card relative overflow-hidden rounded-lg border p-4"
        aria-label={t("locked")}
      >
        <div aria-hidden className="space-y-2 blur-sm select-none">
          <div className="bg-surface-2 h-4 w-3/4 rounded" />
          <div className="bg-surface-2 h-3 w-1/2 rounded" />
        </div>
        <div className="bg-card/60 absolute inset-0 flex items-center justify-between gap-3 px-4">
          <span className="text-muted-foreground text-sm">{t("locked")}</span>
          <Button asChild size="sm">
            <Link href="/#pricing">{t("upgrade")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <article className="bg-card space-y-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="leading-snug font-semibold">
          <Link
            href={`/discover/${row.slug ?? row.story_id}`}
            className="hover:underline"
          >
            {row.title}
          </Link>
        </h3>
        <span className="text-signal font-mono text-sm" title={t("score")}>
          {Math.round(row.final_score)}
        </span>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-xs">
        <span>{t("sources", { count: row.source_count })}</span>
        <span>{t("nicheFit", { value: Math.round(row.niche_fit) })}</span>
        <Sparkline values={trend} label={t("trend")} width={96} height={20} />
      </div>
      {row.why_it_matters && (
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">{t("why")}</span>{" "}
          {row.why_it_matters}
        </p>
      )}
      <AngleButton storyId={row.story_id} nicheId={nicheId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm">
          <Link href={`/studio/new?story=${row.story_id}`}>{t("brief")}</Link>
        </Button>
        <RadarActions storyId={row.story_id} saved={row.saved} />
      </div>
    </article>
  );
}
