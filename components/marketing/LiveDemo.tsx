"use client";

import { Check, Compass, PenLine, Radar } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "discover", Icon: Compass },
  { key: "radar", Icon: Radar },
  { key: "studio", Icon: PenLine },
] as const;
type Tab = (typeof TABS)[number]["key"];

const RADAR_ROWS = {
  high: [
    ["Open-source agent SDK ships tracing and tool use", 91],
    ["Small reasoning model beats larger rivals on coding", 84],
  ],
  early: [["Rust vector database fits on a Raspberry Pi", 66]],
  gaps: [["Browsers agree on shared storage partitioning", 58]],
} as const;
const DOT = {
  high: "bg-signal",
  early: "bg-warning",
  gaps: "bg-brand",
} as const;

function RadarPanel() {
  const t = useTranslations("radar");
  const td = useTranslations("landing.demo");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {(Object.keys(RADAR_ROWS) as (keyof typeof RADAR_ROWS)[]).map((group) => (
        <div key={group} className="overflow-hidden rounded-lg border">
          <div className="bg-surface-2 flex h-9 items-center gap-2 px-4 text-[13px] font-medium">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", DOT[group])}
            />
            {t(`sections.${group}.title`)}
            <span className="text-text-tertiary font-mono text-xs">
              {RADAR_ROWS[group].length}
            </span>
          </div>
          {RADAR_ROWS[group].map(([title, score]) => (
            <div
              key={title}
              className="hover:bg-surface-2/50 space-y-2 border-t px-4 py-3 transition-colors duration-200"
            >
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-[14px] font-medium">
                  {title}
                </p>
                <span className="text-signal font-mono text-xs">{score}</span>
              </div>
              <button
                type="button"
                aria-expanded={open === title}
                onClick={() => setOpen(open === title ? null : title)}
                className="hover:border-border-strong hover:bg-surface-3 h-7 rounded-md border px-2.5 text-[13px] transition-all duration-200 active:scale-95"
              >
                {t("angle.cta")}
              </button>
              {open === title && (
                <p className="animate-panel-in border-brand/30 bg-brand/5 rounded-md border p-3 text-[13px]">
                  <span className="font-medium">{t("angle.label")}</span>{" "}
                  {td("radarAngle")}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StudioPanel() {
  const t = useTranslations("studio");
  const td = useTranslations("landing.demo");
  const te = useTranslations("landing.example");
  const [hook, setHook] = useState(0);
  const [format, setFormat] = useState<"x" | "linkedin" | "shorts">("x");
  const [published, setPublished] = useState(false);
  const hooks = [td("hook1"), td("hook2"), td("hook3")];
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
      <div className="space-y-2">
        <p className="text-[13px] font-medium">{td("hooksLabel")}</p>
        {hooks.map((h, i) => (
          <button
            key={h}
            type="button"
            aria-pressed={hook === i}
            onClick={() => setHook(i)}
            className={cn(
              "flex w-full items-start gap-2 rounded-lg border p-3 text-left text-[13px] transition-all duration-200 active:scale-[0.99]",
              hook === i
                ? "border-brand/60 bg-brand/10"
                : "hover:border-border-strong hover:bg-surface-2",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                hook === i && "border-brand bg-brand text-white",
              )}
            >
              {hook === i && <Check className="size-3" />}
            </span>
            {h}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex gap-1">
          {(["x", "linkedin", "shorts"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] transition-colors duration-200",
                format === f
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {te(`tabs.${f}`)}
            </button>
          ))}
        </div>
        <p
          key={format}
          className="animate-panel-in bg-surface-2 min-h-32 rounded-lg p-3 text-[13px] leading-relaxed whitespace-pre-line"
        >
          {te(format)}
        </p>
        <button
          type="button"
          onClick={() => setPublished(true)}
          disabled={published}
          className={cn(
            "h-8 w-full rounded-md text-[13px] font-medium transition-all duration-300 active:scale-[0.98]",
            published
              ? "bg-signal/15 text-signal"
              : "bg-primary text-primary-foreground hover:shadow-[0_0_24px_-6px_rgba(247,248,248,0.6)]",
          )}
        >
          {published ? (
            <span className="animate-panel-in inline-flex items-center gap-1.5">
              <Check className="size-3.5" />
              {td("published")}
            </span>
          ) : (
            t("publish.cta")
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * The landing's embedded platform: a window whose sidebar really switches between Discover
 * (live stories, rendered on the server and passed in), Radar and Studio (sample data).
 */
export function LiveDemo({ discover }: { discover: React.ReactNode }) {
  const t = useTranslations("nav");
  const td = useTranslations("landing.demo");
  const id = useId();
  const [tab, setTab] = useState<Tab>("discover");

  function onKeyDown(event: React.KeyboardEvent) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const dir =
      event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const next =
      (TABS.findIndex((x) => x.key === tab) + dir + TABS.length) % TABS.length;
    setTab(TABS[next].key);
    document.getElementById(`${id}-${TABS[next].key}`)?.focus();
  }

  return (
    <div className="border-border-strong bg-surface-1 overflow-hidden rounded-xl border shadow-[0_32px_120px_-32px_rgba(94,106,210,0.45)] transition-shadow duration-500 hover:shadow-[0_32px_140px_-28px_rgba(94,106,210,0.65)]">
      <div className="flex h-10 items-center gap-3 border-b px-3">
        <div aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="size-2.5 rounded-full bg-[#28c840]/80" />
        </div>
        <p
          aria-hidden
          className="bg-surface-2 text-text-tertiary mx-auto rounded-md px-12 py-0.5 font-mono text-xs"
        >
          signalcraft.app/{tab}
        </p>
        <span className="w-12" aria-hidden />
      </div>
      <div className="flex flex-col sm:flex-row">
        <div
          role="tablist"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="bg-canvas/40 flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:w-48 sm:flex-col sm:border-r sm:border-b-0"
        >
          {TABS.map(({ key, Icon }) => (
            <button
              key={key}
              id={`${id}-${key}`}
              role="tab"
              type="button"
              aria-selected={tab === key}
              aria-controls={`${id}-panel`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] transition-all duration-200",
                tab === key
                  ? "bg-surface-3 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t(key)}
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab}`}
          className="min-h-[26rem] min-w-0 flex-1 p-3 sm:p-4"
        >
          <div key={tab} className="animate-panel-in">
            {tab === "discover" && discover}
            {tab === "radar" && <RadarPanel />}
            {tab === "studio" && <StudioPanel />}
          </div>
          {tab !== "discover" && (
            <p className="text-text-tertiary mt-4 text-xs">{td("note")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
