"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** "Run now" buttons; each sends the job's admin event through /api/admin/jobs. */
export function JobButtons({ jobs }: { jobs: readonly string[] }) {
  const t = useTranslations("admin");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (job: string) =>
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job }),
      }).catch(() => null);
      setMessage(t(res?.ok ? "queued" : "jobError", { job }));
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <Button
            key={job}
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(job)}
            className="font-mono"
          >
            {job}
          </Button>
        ))}
      </div>
      <p role="status" className="text-muted-foreground text-sm">
        {message}
      </p>
    </div>
  );
}
