import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";
import { NavLinks } from "./NavLinks";

const pill =
  "h-full inline-flex items-center rounded-full px-3 transition-all duration-200";

/** Top bar of the marketing pages: logo on the left; links, language and account on the right. */
export async function MarketingNav() {
  const [t, user] = await Promise.all([getTranslations("nav"), currentUser()]);
  const member = user && !user.anonymous;
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
          className="group flex items-center gap-2.5 text-base font-[590] tracking-tight sm:mr-2"
        >
          <span className="bg-brand/10 ring-brand/25 group-hover:bg-brand/20 grid size-8 place-items-center rounded-lg ring-1 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
            <Radio aria-hidden className="text-brand size-4" />
          </span>
          <span className="sr-only sm:not-sr-only">SignalCraft</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <NavLinks links={links} />
          <LanguageSwitcher />
          {member ? (
            <Button asChild variant="brand" className="h-9 px-4 text-sm">
              <Link href="/discover">{t("openApp")}</Link>
            </Button>
          ) : (
            <div className="bg-surface-2/80 flex h-9 items-center gap-0.5 rounded-full border p-0.5 text-[13px] font-medium">
              <Link
                href="/login"
                className={`${pill} text-muted-foreground hover:text-foreground`}
              >
                {t("signIn")}
              </Link>
              <Link
                href="/signup"
                className={`${pill} text-foreground bg-white/15 shadow-sm hover:bg-white/25`}
              >
                {t("signUp")}
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
