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
  return (
    <article className="hover:bg-surface-2/40 space-y-1.5 border-t px-4 py-3 transition-colors duration-150">
      <div className="flex items-start gap-3">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-[17.5px] leading-snug font-medium sm:line-clamp-1">
          <Link
            href={`/discover/${row.slug ?? row.story_id}`}
            className="hover:underline"
          >
            {row.title}
          </Link>
        </h3>
        <span
          className="text-signal shrink-0 font-mono text-xs"
          title={t("score")}
        >
          {Math.round(row.final_score)}
        </span>
      </div>
      <div className="text-text-tertiary flex flex-wrap items-center gap-3 font-mono text-xs">
        <span>{t("sources", { count: row.source_count })}</span>
        <span>{t("nicheFit", { value: Math.round(row.niche_fit) })}</span>
        <Sparkline values={trend} label={t("trend")} width={96} height={20} />
      </div>
      {row.why_it_matters && (
        <p className="text-muted-foreground text-[16.25px]">
          <span className="text-foreground font-medium">{t("why")}</span>{" "}
          {row.why_it_matters}
        </p>
      )}
      <AngleButton storyId={row.story_id} nicheId={nicheId} />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <Button asChild size="sm">
          <Link href={`/studio/new?story=${row.story_id}`}>{t("brief")}</Link>
        </Button>
        <RadarActions storyId={row.story_id} saved={row.saved} />
      </div>
    </article>
  );
}
