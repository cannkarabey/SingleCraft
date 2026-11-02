"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Source = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  trust_weight: number;
  lastFetched: string;
  last_error: string | null;
  consecutive_failures: number;
};

/** One editable source row: active toggle saves at once, trust saves on "Save". */
export function SourceRow({ source }: { source: Source }) {
  const t = useTranslations("admin");
  const [active, setActive] = useState(source.active);
  const [trust, setTrust] = useState(String(source.trust_weight));
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (body: { active?: boolean; trust_weight?: number }) =>
    startTransition(async () => {
      setStatus(null);
      const res = await fetch(`/api/admin/sources/${source.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      setStatus(res?.ok ? "saved" : "error");
    });

  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-3">
        <span className="font-medium">{source.name}</span>
        <span className="text-muted-foreground ml-2 font-mono text-xs">
          {source.type}
        </span>
      </td>
      <td className="py-2 pr-3">
        <input
          type="checkbox"
          aria-label={t("active")}
          checked={active}
          disabled={pending}
          onChange={(e) => {
            setActive(e.target.checked);
            save({ active: e.target.checked });
          }}
        />
      </td>
      <td className="py-2 pr-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save({ trust_weight: Number(trust) });
          }}
        >
          <input
            aria-label={t("trust")}
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={trust}
            onChange={(e) => setTrust(e.target.value)}
            className="bg-surface-1 h-8 w-20 rounded-md border px-2 font-mono text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {t("save")}
          </Button>
        </form>
      </td>
      <td className="text-muted-foreground py-2 pr-3 font-mono text-xs">
        {source.lastFetched}
      </td>
      <td className="py-2 pr-3 text-xs">
        {source.consecutive_failures > 0 && (
          <span className="text-danger font-mono">
            ×{source.consecutive_failures}{" "}
          </span>
        )}
        <span className="text-muted-foreground break-all">
          {source.last_error}
        </span>
      </td>
      <td className="py-2 text-xs">
        <span
          role="status"
          className={status === "error" ? "text-danger" : "text-signal"}
        >
          {status && t(status)}
        </span>
      </td>
    </tr>
  );
}
