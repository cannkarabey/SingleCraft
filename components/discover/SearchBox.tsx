"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/** GET form so search works without JavaScript; ⌘K / Ctrl+K focuses it. */
export function SearchBox({
  defaultValue,
  hidden,
}: {
  defaultValue?: string;
  hidden: Record<string, string | undefined>;
}) {
  const t = useTranslations("discover");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      action="/discover"
      role="search"
      className="relative w-full sm:max-w-xs"
    >
      {Object.entries(hidden).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <input
        ref={input}
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={200}
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        className="bg-surface-1 placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-md border pr-3 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
    </form>
  );
}
