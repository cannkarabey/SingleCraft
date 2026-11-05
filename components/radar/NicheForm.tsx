"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PLATFORMS, TONES, type NicheInput } from "@/lib/radar/niches";
import { TermInput } from "./TermInput";

const SUGGESTIONS = [
  "AI agents",
  "LLM",
  "developer tools",
  "open source",
  "indie hacking",
  "React",
  "security",
  "startups",
];

type Values = {
  name: string;
  keywords: string[];
  platforms: (typeof PLATFORMS)[number][];
  language: "tr" | "en";
  tone: (typeof TONES)[number];
  excluded_keywords: string[];
  tracked_channels: string[];
};

const STEPS = ["topic", "platforms", "voice", "filters"] as const;

/**
 * Niche editor. `mode="wizard"` shows one step at a time (onboarding, plan §8.2);
 * `mode="settings"` shows every section and saves in place.
 */
export function NicheForm({
  mode,
  initial,
  nicheId,
}: {
  mode: "wizard" | "settings";
  initial?: Partial<Values>;
  nicheId?: string;
}) {
  const t = useTranslations("niche");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "limit">(
    "idle",
  );
  const [values, setValues] = useState<Values>({
    name: "",
    keywords: [],
    platforms: [],
    language: "tr",
    tone: "analytical",
    excluded_keywords: [],
    tracked_channels: [],
    ...initial,
  });
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const visible = (s: (typeof STEPS)[number]) =>
    mode === "settings" || STEPS[step] === s;
  const canContinue = STEPS[step] !== "topic" || values.name.trim().length > 0;

  function save() {
    startTransition(async () => {
      const res = await fetch(
        nicheId ? `/api/radar/niches/${nicheId}` : "/api/radar/niches",
        {
          method: nicheId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values satisfies NicheInput),
        },
      );
      if (res.ok) {
        setStatus("saved");
        if (mode === "wizard") router.push("/radar");
        else router.refresh();
      } else {
        setStatus(res.status === 403 ? "limit" : "error");
      }
    });
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "wizard" && step < STEPS.length - 1) {
          if (canContinue) setStep(step + 1);
        } else {
          save();
        }
      }}
    >
      {mode === "wizard" && (
        <p className="text-muted-foreground font-mono text-xs">
          {t("step", { current: step + 1, total: STEPS.length })}
        </p>
      )}

      {visible("topic") && (
        <fieldset className="space-y-4">
          <legend className="text-[18.75px] font-[590]">
            {t("topic.title")}
          </legend>
          <label className="block space-y-1.5 text-[16.25px]">
            <span>{t("topic.name")}</span>
            <input
              required
              maxLength={60}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("topic.namePlaceholder")}
              className="bg-surface-2 focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-[16.25px] focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>
          <TermInput
            label={t("topic.keywords")}
            value={values.keywords}
            onChange={(v) => set("keywords", v)}
            suggestions={SUGGESTIONS}
            placeholder={t("topic.keywordsPlaceholder")}
            removeLabel={t("remove")}
          />
        </fieldset>
      )}

      {visible("platforms") && (
        <fieldset className="space-y-3">
          <legend className="text-[18.75px] font-[590]">
            {t("platforms.title")}
          </legend>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.platforms.includes(p)}
                  onChange={(e) =>
                    set(
                      "platforms",
                      e.target.checked
                        ? [...values.platforms, p]
                        : values.platforms.filter((x) => x !== p),
                    )
                  }
                />
                {t(`platforms.${p}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {visible("voice") && (
        <fieldset className="space-y-4">
          <legend className="text-[18.75px] font-[590]">
            {t("voice.title")}
          </legend>
          <div
            className="flex gap-4"
            role="radiogroup"
            aria-label={t("voice.language")}
          >
            {(["tr", "en"] as const).map((lang) => (
              <label key={lang} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="language"
                  checked={values.language === lang}
                  onChange={() => set("language", lang)}
                />
                {t(`voice.languages.${lang}`)}
              </label>
            ))}
          </div>
          <label className="block space-y-1.5 text-[16.25px]">
            <span>{t("voice.tone")}</span>
            <select
              value={values.tone}
              onChange={(e) => set("tone", e.target.value as Values["tone"])}
              className="bg-surface-2 h-10 w-full rounded-md border px-2 text-[16.25px]"
            >
              {TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {t(`voice.tones.${tone}`)}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}

      {visible("filters") && (
        <fieldset className="space-y-4">
          <legend className="text-[18.75px] font-[590]">
            {t("filters.title")}
          </legend>
          <TermInput
            label={t("filters.excluded")}
            value={values.excluded_keywords}
            onChange={(v) => set("excluded_keywords", v)}
            removeLabel={t("remove")}
          />
          <TermInput
            label={t("filters.tracked")}
            value={values.tracked_channels}
            onChange={(v) => set("tracked_channels", v)}
            placeholder={t("filters.trackedPlaceholder")}
            removeLabel={t("remove")}
          />
        </fieldset>
      )}

      {status === "error" && (
        <p role="alert" className="text-danger text-sm">
          {t("error")}
        </p>
      )}
      {status === "limit" && (
        <p role="alert" className="text-danger text-sm">
          {t("limit")}
        </p>
      )}
      {status === "saved" && mode === "settings" && (
        <p role="status" className="text-signal text-sm">
          {t("saved")}
        </p>
      )}

      <div className="flex gap-2">
        {mode === "wizard" && step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
          >
            {t("back")}
          </Button>
        )}
        <Button type="submit" disabled={pending || !canContinue}>
          {mode === "wizard"
            ? step < STEPS.length - 1
              ? t("next")
              : t("finish")
            : t("save")}
        </Button>
      </div>
    </form>
  );
}
