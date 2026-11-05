"use client";

import {
  Compass,
  PenLine,
  Radar,
  Search,
  Settings,
  Shield,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  discover: Compass,
  radar: Radar,
  studio: PenLine,
  settings: Settings,
  admin: Shield,
  signIn: LogIn,
};

export type SidebarItem = { key: string; href: string; label: string };

/** Sidebar link list; the module matching the URL (prefix match, so nested routes too) is current. */
export function SidebarNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map(({ key, href, label }) => {
        const path = href.split("?")[0];
        const active =
          key !== "search" &&
          (pathname === path || pathname.startsWith(`${path}/`));
        const Icon = ICONS[key];
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-2 text-[16.25px] transition-colors duration-150",
                active
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
