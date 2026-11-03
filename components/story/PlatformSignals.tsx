import { getLocale } from "next-intl/server";
import { compactNumber } from "@/lib/discover/format";
import type { Signals } from "@/lib/discover/queries";

const CHIPS: { key: keyof Signals; label: string }[] = [
  { key: "hn_points", label: "HN" },
  { key: "reddit_upvotes", label: "Reddit" },
  { key: "github_stars", label: "GitHub" },
  { key: "producthunt_votes", label: "PH" },
];

/** Platform chips like `HN 412` `GitHub 1.2K` (mono metadata). */
export async function PlatformSignals({
  signals,
}: {
  signals: Signals | null;
}) {
  if (!signals) return null;
  const locale = await getLocale();
  const chips = CHIPS.filter(({ key }) => (signals[key] ?? 0) > 0);
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 font-mono text-xs">
      {chips.map(({ key, label }) => (
        <li
          key={key}
          className="bg-surface-2 text-muted-foreground rounded-md border px-1.5 py-0.5"
        >
          {label}{" "}
          <span className="text-foreground">
            {compactNumber(signals[key], locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
