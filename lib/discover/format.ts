// Presentation helpers shared by story cards, detail and landing preview.

export type SignalLevel = "high" | "early" | "normal" | "low";

const HIGH_SCORE = 75;
const LOW_TRUST = 0.4;

/** Signal bar colour (plan §5.6): low trust wins, then high score, then early signal. */
export function signalLevel(story: {
  global_score: number;
  is_early_signal: boolean;
  trust_score: number;
}): SignalLevel {
  // trust 0 means "not scored yet", not "untrusted".
  if (story.trust_score > 0 && story.trust_score < LOW_TRUST) return "low";
  if (story.global_score >= HIGH_SCORE) return "high";
  if (story.is_early_signal) return "early";
  return "normal";
}

export function compactNumber(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const MINUTE_MS = 60_000;

/** "2h ago" style, narrow, in the reader's locale. */
export function relativeTime(
  date: string | Date,
  now: Date,
  locale: string,
): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(date).getTime()) / MINUTE_MS),
  );
  const format = new Intl.RelativeTimeFormat(locale, {
    style: "narrow",
    numeric: "always",
  });
  if (minutes < 60) return format.format(-minutes, "minute");
  if (minutes < 24 * 60)
    return format.format(-Math.floor(minutes / 60), "hour");
  return format.format(-Math.floor(minutes / (24 * 60)), "day");
}
