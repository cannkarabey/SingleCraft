import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";

const MODULES = ["discover", "radar", "studio"] as const;

export async function TopNav() {
  const t = await getTranslations("nav");
  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <nav
        aria-label="SignalCraft"
        className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4"
      >
        <Link href="/" className="font-semibold tracking-tight">
          SignalCraft
        </Link>
        <ul className="flex items-center gap-1 overflow-x-auto text-sm">
          {MODULES.map((module) => (
            <li key={module}>
              <Link
                href={`/${module}`}
                className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5 transition-colors duration-150"
              >
                {t(module)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("search")}
            className="hidden sm:inline-flex"
          >
            <Search />
          </Button>
          <LanguageSwitcher />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/discover">{t("cta")}</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
