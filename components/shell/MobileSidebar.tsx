"use client";

import { Menu, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Mobile top bar with a menu button; the (server-rendered) sidebar opens as a slide-over. */
export function MobileSidebar({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  // Navigating (a link inside the panel) closes it.
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <div className="bg-canvas sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3">
        <Button
          ref={button}
          variant="ghost"
          size="icon"
          aria-label={t("menu")}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Menu />
        </Button>
        <Link
          href="/"
          className="flex items-center gap-2 text-[18.75px] font-[590] tracking-tight"
        >
          <Radio aria-hidden className="text-brand size-4" />
          SignalCraft
        </Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            aria-hidden
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}
          />
          <div className="bg-canvas absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
