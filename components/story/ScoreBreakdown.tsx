import { getTranslations } from "next-intl/server";

type Scores = {
  global_score: number;
  velocity_score: number;
  engagement_score: number;
  source_diversity_score: number;
  freshness_score: number;
  trust_score: number;
};

/** Sub-score bars (0–100; trust shown as a percentage). */
export async function ScoreBreakdown({ scores }: { scores: Scores }) {
  const t = await getTranslations("story.score");
  const rows: [string, number][] = [
    [t("global"), scores.global_score],
    [t("velocity"), scores.velocity_score],
    [t("engagement"), scores.engagement_score],
    [t("diversity"), scores.source_diversity_score],
    [t("freshness"), scores.freshness_score],
    [t("trust"), scores.trust_score * 100],
  ];
  return (
    <dl className="space-y-2">
      {rows.map(([label, value]) => {
        const pct = Math.max(0, Math.min(100, value));
        return (
          <div
            key={label}
            className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-[13px]"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="bg-surface-2 h-1.5 overflow-hidden rounded-full">
              <span
                className="bg-signal/80 block h-full rounded-full"
                style={{ width: `${pct}%` }}
              />
            </dd>
            <dd className="text-right font-mono text-xs">{Math.round(pct)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
