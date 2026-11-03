"use client";

import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { loadMoreStories } from "@/app/(app)/discover/actions";
import { Button } from "@/components/ui/button";

/** Appends server-rendered pages; loads automatically near the bottom, with a button fallback. */
export function LoadMore({
  query,
  initialCursor,
}: {
  query: Record<string, string | undefined>;
  initialCursor: string | null;
}) {
  const t = useTranslations("discover");
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!cursor || pending) return;
    startTransition(async () => {
      const page = await loadMoreStories({ ...query, cursor });
      setPages((prev) => [...prev, ...page.nodes]);
      setCursor(page.nextCursor);
    });
  }, [cursor, pending, query]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && load(),
      {
        rootMargin: "400px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, load]);

  return (
    <>
      {pages}
      {cursor && (
        <div ref={sentinel} className="flex justify-center border-t p-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={pending}>
            {pending ? t("loading") : t("loadMore")}
          </Button>
        </div>
      )}
    </>
  );
}
