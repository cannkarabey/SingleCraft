"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades and lifts its children in when they scroll into view. Content that is already on
 * screen (or rendered without JS) is never hidden, so there is no flash and no lost text.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** ms */
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"ssr" | "hidden" | "shown">("ssr");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Intentional: the initial paint is visible; only below-the-fold nodes are hidden.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) {
      setState("shown");
      return;
    }
    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        state === "hidden" && "translate-y-8 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
