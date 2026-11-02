import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { currentUser } from "@/lib/auth/session";
import { LanguageSwitcher } from "./LanguageSwitcher";

const MODULES = ["discover", "radar", "studio"] as const;

export async function TopNav() {
  const [t, user] = await Promise.all([getTranslations("nav"), currentUser()]);
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
          {user ? (
            <form action={signOut}>
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                title={user.email ?? undefined}
              >
                {t("signOut")}
              </Button>
            </form>
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
