import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";
import { NavLinks } from "./NavLinks";

/** Top bar of the marketing pages: logo, module links, sign-in and the main CTA. */
export async function MarketingNav() {
  const [t, user] = await Promise.all([getTranslations("nav"), currentUser()]);
  const links = (["discover", "radar", "studio", "pricing"] as const).map(
    (key) => ({
      href: key === "pricing" ? "/pricing" : `/${key}`,
      label: t(key),
    }),
  );
  return (
    <header className="nav-scroll-border bg-canvas/70 sticky top-0 z-40 backdrop-blur-xl">
      <nav
        aria-label="SignalCraft"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-6"
      >
        <Link
          href="/"
          className="group mr-2 flex items-center gap-2.5 text-base font-[590] tracking-tight"
        >
          <span className="bg-brand/15 ring-brand/30 group-hover:bg-brand/25 grid size-8 place-items-center rounded-lg ring-1 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
            <Radio aria-hidden className="text-brand-text size-4" />
          </span>
          SignalCraft
        </Link>
        <NavLinks links={links} />
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <Button asChild variant="brand" className="h-9 px-4 text-sm">
              <Link href="/discover">{t("openApp")}</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="h-9 rounded-full px-4 text-sm"
              >
                <Link href="/login">{t("signIn")}</Link>
              </Button>
              <Button
                asChild
                variant="brand"
                className="hidden h-9 rounded-full px-4 text-sm sm:inline-flex"
              >
                <Link href="/login?next=%2Fonboarding">{t("cta")}</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
