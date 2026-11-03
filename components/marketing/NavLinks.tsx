"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Centre links of the marketing nav; the current section gets a lit pill. */
export function NavLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-all duration-200",
                active
                  ? "text-foreground bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
