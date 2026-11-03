"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Upgrade (hosted checkout) or manage (customer portal); both redirect to Lemon Squeezy. */
export function BillingActions({ paid }: { paid: boolean }) {
  const t = useTranslations("billing");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const go = (path: string, body?: object) =>
    startTransition(async () => {
      setError(null);
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }).catch(() => null);
      if (res?.ok) {
        const { url } = (await res.json()) as { url: string };
        window.location.assign(url);
        return;
      }
      setError(
        res?.status === 503 || res?.status === 409
          ? t("unavailable")
          : t("error"),
      );
    });

  return (
    <div className="space-y-2">
      {paid ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => go("/api/billing/portal")}
        >
          {t("manage")}
        </Button>
      ) : (
        <Button
          disabled={pending}
          onClick={() => go("/api/billing/checkout", { plan: "creator" })}
        >
          {t("upgrade")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-danger text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}
