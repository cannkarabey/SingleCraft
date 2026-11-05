"use client";

import { Download, Filter, Gauge, Network, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ICONS = [Download, Filter, Network, Gauge, PenLine];
const STEP_MS = 2600;

/**
 * "How it works": five steps joined by a progress line. A highlight walks through the
 * steps by itself (paused while the pointer or focus is inside) and any step can be hovered.
 */
export function PipelineSteps({
  steps,
}: {
  steps: { key: string; title: string; detail: string }[];
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(
      () => setActive((i) => (i + 1) % steps.length),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [paused, steps.length]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative"
    >
      <div
        aria-hidden
        className="bg-border absolute top-[2.15rem] right-[10%] left-[10%] hidden h-px lg:block"
      >
        <div
          className="from-brand to-brand-text h-full bg-gradient-to-r shadow-[0_0_12px_rgba(139,148,236,0.9)] transition-[width] duration-700 ease-out"
          style={{ width: `${(active / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <ol className="grid gap-3 lg:grid-cols-5">
        {steps.map((step, i) => {
          const Icon = ICONS[i] ?? Download;
          const on = i === active;
          const done = i < active;
          return (
            <li key={step.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "relative block h-full w-full rounded-xl border p-5 text-left transition-all duration-500",
                  on
                    ? "border-brand/60 bg-[color-mix(in_oklab,var(--sc-brand)_14%,var(--sc-surface-1))] shadow-[0_16px_48px_-16px_rgba(94,106,210,0.8)] lg:-translate-y-1.5"
                    : "bg-surface-1 hover:border-white/20",
                )}
              >
                <span
                  className={cn(
                    "mb-4 grid size-9 place-items-center rounded-full border transition-all duration-500",
                    on
                      ? "bg-brand animate-pulse-ring border-transparent text-white"
                      : done
                        ? "border-brand/50 text-brand-text"
                        : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="text-brand-text block font-mono text-xs">
                  0{i + 1}
                </span>
                <span className="mt-1 block font-[590] tracking-tight">
                  {step.title}
                </span>
                <span
                  className={cn(
                    "text-muted-foreground mt-2 block text-[13px] leading-relaxed transition-all duration-500",
                    on ? "opacity-100" : "opacity-70",
                  )}
                >
                  {step.detail}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
