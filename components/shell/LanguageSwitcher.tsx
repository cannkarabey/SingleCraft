"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const current = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="flex font-mono text-xs"
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          aria-pressed={locale === current}
          onClick={() =>
            startTransition(async () => {
              await setLocale(locale);
              router.refresh();
            })
          }
          className={cn(
            "rounded px-1.5 py-1 transition-colors duration-150",
            locale === current
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
