"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

/**
 * A module card showing the real page. Moving the pointer tilts the card, drags a light
 * across it and nudges the screenshot; leaving settles everything back.
 */
export function ModuleCard({
  href,
  caption,
  title,
  body,
  open,
  image,
  alt,
}: {
  href: string;
  caption: string;
  title: string;
  body: string;
  open: string;
  image: string;
  alt: string;
}) {
  const card = useRef<HTMLAnchorElement>(null);

  function move(event: React.PointerEvent<HTMLAnchorElement>) {
    const node = card.current;
    if (!node || event.pointerType === "touch") return;
    const r = node.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    node.style.setProperty("--mx", `${x * 100}%`);
    node.style.setProperty("--my", `${y * 100}%`);
    node.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
    node.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
  }
  function leave() {
    const node = card.current;
    if (!node) return;
    for (const v of ["--rx", "--ry"]) node.style.setProperty(v, "0deg");
  }

  return (
    <Link
      ref={card}
      href={href}
      onPointerMove={move}
      onPointerLeave={leave}
      className="group bg-surface-1 relative block [transform:perspective(900px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] rounded-xl border p-3 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:border-white/20 hover:shadow-[0_24px_80px_-24px_rgba(94,106,210,0.7)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(139,148,236,0.16), transparent 60%)",
        }}
      />
      <div className="bg-canvas relative mb-5 aspect-[4/3] overflow-hidden rounded-lg border">
        <Image
          src={image}
          alt={alt}
          fill
          sizes="(min-width: 768px) 380px, 100vw"
          className="object-cover object-left-top transition-transform duration-700 ease-out group-hover:-translate-y-1 group-hover:scale-[1.07]"
        />
        <span
          aria-hidden
          className="from-surface-1/80 pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t to-transparent"
        />
      </div>
      <div className="relative space-y-2 px-3 pb-3">
        <p className="text-text-tertiary font-mono text-xs">{caption}</p>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-[590] tracking-tight">{title}</h3>
          <span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 text-[16.25px] transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            {open}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </Link>
  );
}
