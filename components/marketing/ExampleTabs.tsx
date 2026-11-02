"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/** Accessible tabs (arrow keys move between tabs) for the example output section. */
export function ExampleTabs({
  tabs,
}: {
  tabs: { key: string; label: string; body: string }[];
}) {
  const [active, setActive] = useState(0);
  const id = useId();

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next =
      (active + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
      tabs.length;
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <div className="bg-card rounded-lg border">
      <div
        role="tablist"
        className="flex gap-1 border-b p-1"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            id={`${id}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`${id}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition-colors duration-150",
              i === active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="p-5 text-sm leading-relaxed whitespace-pre-line"
      >
        {tabs[active].body}
      </div>
    </div>
  );
}
