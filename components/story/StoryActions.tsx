"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Add to Radar" / "Generate in Studio". Both need an account; signed-out visitors get a
 * sign-in prompt (plan §8.2). Signed-in behaviour arrives with Faz 5/6.
 */
export function StoryActions({ storyId }: { storyId: string }) {
  const t = useTranslations("discover");
  const dialog = useRef<HTMLDialogElement>(null);
  const open = () => dialog.current?.showModal();

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={open}>
        {t("actions.addToRadar")}
      </Button>
      <Button size="sm" variant="outline" onClick={open}>
        {t("actions.generate")}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`signin-${storyId}`}
        className="bg-card text-card-foreground m-auto w-[min(92vw,26rem)] rounded-lg border p-6 backdrop:bg-black/60"
      >
        <h2 id={`signin-${storyId}`} className="text-lg font-semibold">
          {t("signIn.title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">{t("signIn.body")}</p>
        <form method="dialog" className="mt-6 flex justify-end gap-2">
          <Button type="submit" variant="ghost" size="sm">
            {t("signIn.close")}
          </Button>
          <Button asChild size="sm">
            <Link
              href={`/login?next=${encodeURIComponent(`/discover/${storyId}`)}`}
            >
              {t("signIn.cta")}
            </Link>
          </Button>
        </form>
      </dialog>
    </div>
  );
}
