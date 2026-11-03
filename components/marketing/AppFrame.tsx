import { Compass, PenLine, Radar } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "discover", Icon: Compass },
  { key: "radar", Icon: Radar },
  { key: "studio", Icon: PenLine },
] as const;

/** A static app window (title bar + mini sidebar) that frames product content on marketing pages. */
export async function AppFrame({
  active,
  children,
  className,
}: {
  active: (typeof ITEMS)[number]["key"];
  children: React.ReactNode;
  className?: string;
}) {
  const t = await getTranslations("nav");
  return (
    <div
      className={cn(
        "border-border-strong bg-surface-1 overflow-hidden rounded-xl border shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div aria-hidden className="flex h-9 items-center gap-1.5 border-b px-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-surface-3 size-2.5 rounded-full" />
        ))}
      </div>
      <div className="flex">
        <div
          aria-hidden
          className="bg-canvas/40 hidden w-44 shrink-0 space-y-0.5 border-r p-2 sm:block"
        >
          {ITEMS.map(({ key, Icon }) => (
            <div
              key={key}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-[13px]",
                key === active
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t(key)}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}
