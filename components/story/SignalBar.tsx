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
  shape = "bar",
  className,
}: {
  level: SignalLevel;
  /** "bar" on the detail header, "dot" in list rows. */
  shape?: "bar" | "dot";
  className?: string;
}) {
  const t = await getTranslations("discover.signal");
  return (
    <span
      role="img"
      aria-label={t(level)}
      title={t(level)}
      className={cn(
        "shrink-0 rounded-full",
        shape === "dot" ? "size-2" : "w-[3px] self-stretch",
        COLORS[level],
        className,
      )}
    />
  );
}
