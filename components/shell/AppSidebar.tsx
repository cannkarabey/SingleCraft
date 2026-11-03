import { Radio } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/lib/auth/actions";
import { currentUser } from "@/lib/auth/session";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileSidebar } from "./MobileSidebar";
import { SidebarNav, type SidebarItem } from "./SidebarNav";

/** Everything inside the sidebar; rendered for the desktop rail and the mobile slide-over. */
async function SidebarBody() {
  const [t, user, admin] = await Promise.all([
    getTranslations("nav"),
    currentUser(),
    requireAdmin(),
  ]);
  const item = (key: string, href: string): SidebarItem => ({
    key,
    href,
    label: t(key),
  });

  const modules = user
    ? [
        item("discover", "/discover"),
        item("radar", "/radar"),
        item("studio", "/studio"),
      ]
    : [item("discover", "/discover")];
  const account = user
    ? [
        item("settings", "/settings"),
        ...(admin ? [item("admin", "/admin")] : []),
      ]
    : [item("signIn", "/login")];

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <Link
        href="/"
        className="hidden items-center gap-2 px-2 pt-1 text-[15px] font-[590] tracking-tight md:flex"
      >
        <Radio aria-hidden className="text-brand size-4" />
        SignalCraft
      </Link>
      <nav aria-label={t("app")} className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex-1 space-y-4 overflow-y-auto">
          <SidebarNav items={[item("search", "/discover?focus=search")]} />
          <SidebarNav items={modules} />
          <SidebarNav items={account} />
          {!user && (
            <Button asChild size="sm" className="w-full">
              <Link href="/login?next=%2Fonboarding">{t("cta")}</Link>
            </Button>
          )}
        </div>
        <div className="space-y-2 border-t px-1 pt-3">
          <LanguageSwitcher />
          {user && (
            <div className="flex items-center gap-2">
              <p
                title={user.email ?? undefined}
                className="text-text-tertiary min-w-0 flex-1 truncate text-xs"
              >
                {user.email}
              </p>
              <form action={signOut}>
                <Button type="submit" size="xs" variant="ghost">
                  {t("signOut")}
                </Button>
              </form>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

/** App shell navigation: a fixed rail from md up, a slide-over menu below. */
export function AppSidebar() {
  return (
    <>
      <aside className="bg-canvas sticky top-0 hidden h-screen w-60 shrink-0 md:block">
        <SidebarBody />
      </aside>
      <MobileSidebar>
        <SidebarBody />
      </MobileSidebar>
    </>
  );
}
