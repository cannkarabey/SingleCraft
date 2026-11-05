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
      className="bg-surface-2/80 flex h-11 items-center gap-0.5 rounded-full border p-0.5 text-[16.25px] font-medium"
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
            "h-full rounded-full px-3 transition-all duration-200",
            locale === current
              ? "text-foreground bg-white/15 shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
