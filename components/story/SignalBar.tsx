import { getTranslations } from "next-intl/server";
import type { SignalLevel } from "@/lib/discover/format";
import { cn } from "@/lib/utils";

const COLORS: Record<SignalLevel, string> = {
  high: "bg-signal",
  early: "bg-warning",
  low: "bg-danger",
  normal: "bg-muted-foreground/40",
};

/** Thin left-edge bar on a story card (PDF §12): green high, yellow early, red low trust. */
export async function SignalBar({
  level,
  className,
}: {
  level: SignalLevel;
  className?: string;
}) {
  const t = await getTranslations("discover.signal");
  return (
    <span
      role="img"
      aria-label={t(level)}
      title={t(level)}
      className={cn(
        "w-[3px] shrink-0 self-stretch rounded-full",
        COLORS[level],
        className,
      )}
    />
  );
}
