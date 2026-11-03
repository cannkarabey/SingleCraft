import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";

const LINKS = [
  { href: "/discover", key: "discover" },
  { href: "/radar", key: "radar" },
  { href: "/studio", key: "studio" },
  { href: "/pricing", key: "pricing" },
] as const;

/** Top bar of the marketing pages: logo, module links, sign-in and the main CTA. */
export async function MarketingNav() {
  const [t, user] = await Promise.all([getTranslations("nav"), currentUser()]);
  return (
    <header className="nav-scroll-border bg-canvas/80 sticky top-0 z-40 backdrop-blur-md">
      <nav
        aria-label="SignalCraft"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-6"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-[590] tracking-tight"
        >
          <Radio aria-hidden className="text-brand size-4" />
          SignalCraft
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ href, key }) => (
            <li key={key}>
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150"
              >
                {t(key)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <Button asChild size="sm">
              <Link href="/discover">{t("openApp")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">{t("signIn")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/login?next=%2Fonboarding">{t("cta")}</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
