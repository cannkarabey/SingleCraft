import { getLocale } from "next-intl/server";
import { relativeTime } from "@/lib/discover/format";

type Source = {
  raw_item_id: number;
  title: string;
  url: string;
  published_at: string;
  source_name: string;
  source_type: string;
};

const SAFE_URL = /^https?:\/\//i;

/** Original sources with type, name and time; external links only for http(s). */
export async function SourceList({
  sources,
  now,
}: {
  sources: Source[];
  now: Date;
}) {
  const locale = await getLocale();
  return (
    <ul className="divide-y overflow-hidden rounded-lg border">
      {sources.map((s) => (
        <li key={s.raw_item_id} className="flex flex-col gap-1 p-3">
          {SAFE_URL.test(s.url) ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[13px] font-medium break-words hover:underline"
            >
              {s.title}
            </a>
          ) : (
            <span className="text-[13px] font-medium break-words">
              {s.title}
            </span>
          )}
          <span className="text-text-tertiary font-mono text-xs">
            {s.source_type} · {s.source_name} ·{" "}
            {relativeTime(s.published_at, now, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
