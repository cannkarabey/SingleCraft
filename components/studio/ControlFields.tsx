"use client";

import { useTranslations } from "next-intl";
import { TONES } from "@/lib/radar/niches";
import {
  LENGTHS,
  STUDIO_FORMATS,
  STUDIO_PLATFORMS,
  type ControlsInput,
} from "@/lib/studio/controls";

const field =
  "h-10 w-full rounded-md border bg-surface-2 px-2 text-[16.25px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Platform / format / tone / audience / length / own take (plan §8.2 control panel). */
export function ControlFields({
  value,
  onChange,
}: {
  value: ControlsInput;
  onChange: (next: ControlsInput) => void;
}) {
  const t = useTranslations("studio.controls");
  const tn = useTranslations("niche.voice.tones");
  const set = <K extends keyof ControlsInput>(key: K, v: ControlsInput[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-[16.25px]">
        <span className="text-muted-foreground">{t("platform")}</span>
        <select
          className={field}
          value={value.platform}
          onChange={(e) =>
            set("platform", e.target.value as ControlsInput["platform"])
          }
        >
          {STUDIO_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {t(`platforms.${p}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-[16.25px]">
        <span className="text-muted-foreground">{t("format")}</span>
        <select
          className={field}
          value={value.format}
          onChange={(e) =>
            set("format", e.target.value as ControlsInput["format"])
          }
        >
          {STUDIO_FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`formats.${f}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-[16.25px]">
        <span className="text-muted-foreground">{t("tone")}</span>
        <select
          className={field}
          value={value.tone}
          onChange={(e) => set("tone", e.target.value as ControlsInput["tone"])}
        >
          {TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tn(tone)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-[16.25px]">
        <span className="text-muted-foreground">{t("audience")}</span>
        <input
          className={field}
          maxLength={100}
          value={value.audience ?? ""}
          onChange={(e) => set("audience", e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-[16.25px]">
        <span className="text-muted-foreground">{t("length")}</span>
        <select
          className={field}
          value={value.length ?? "medium"}
          onChange={(e) =>
            set("length", e.target.value as ControlsInput["length"])
          }
        >
          {LENGTHS.map((l) => (
            <option key={l} value={l}>
              {t(`lengths.${l}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-[16.25px]">
        <span className="text-muted-foreground">{t("userTake")}</span>
        <textarea
          className="bg-surface-2 focus-visible:ring-ring min-h-20 w-full rounded-md border p-2 text-[16.25px] focus-visible:ring-2 focus-visible:outline-none"
          maxLength={1000}
          value={value.user_take ?? ""}
          onChange={(e) => set("user_take", e.target.value)}
        />
      </label>
    </div>
  );
}
