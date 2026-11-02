"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ControlsInput } from "@/lib/studio/controls";
import { ControlFields } from "./ControlFields";

export function NewBriefForm({
  storyId,
  defaults,
}: {
  storyId: string;
  defaults: ControlsInput;
}) {
  const t = useTranslations("studio");
  const router = useRouter();
  const [controls, setControls] = useState(defaults);
  const [error, setError] = useState<"limit" | "notFound" | "generic" | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/studio/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...controls, storyId }),
        });
        if (res.status === 202) {
          const { briefId } = (await res.json()) as { briefId: string };
          router.push(`/studio/${briefId}`);
          return;
        }
        setError(
          res.status === 429
            ? "limit"
            : res.status === 404
              ? "notFound"
              : "generic",
        );
      } catch {
        setError("generic");
      }
    });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ControlFields value={controls} onChange={setControls} />
      {error && (
        <p role="alert" className="text-danger text-sm">
          {t(`errors.${error}`)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("generating") : t("generate")}
      </Button>
    </form>
  );
}
