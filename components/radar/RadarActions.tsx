"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Save / hide a story on Radar. Hiding re-renders the server list without it. */
export function RadarActions({
  storyId,
  saved: initialSaved,
}: {
  storyId: string;
  saved: boolean;
}) {
  const t = useTranslations("radar");
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  const post = (action: "save" | "hide") =>
    startTransition(async () => {
      const res = await fetch(`/api/radar/${storyId}/${action}`, {
        method: "POST",
      });
      if (!res.ok) return;
      if (action === "save") setSaved(true);
      else router.refresh();
    });

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending || saved}
        onClick={() => post("save")}
      >
        {saved ? t("saved") : t("save")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => post("hide")}
      >
        {t("hide")}
      </Button>
    </div>
  );
}
