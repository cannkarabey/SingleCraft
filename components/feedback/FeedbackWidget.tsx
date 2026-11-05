"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Status = "sent" | "limit" | "error" | null;

/** Beta feedback (plan §9 Faz 9): a corner button opening a short form. */
export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setStatus(null);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, page: window.location.pathname }),
      }).catch(() => null);
      if (res?.ok) {
        setMessage("");
        setStatus("sent");
      } else setStatus(res?.status === 429 ? "limit" : "error");
    });

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <section
          role="dialog"
          aria-labelledby={`${id}-title`}
          className="bg-surface-2 border-border-strong w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border p-4 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)]"
        >
          <h2 id={`${id}-title`} className="text-[16.25px] font-medium">
            {t("title")}
          </h2>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor={`${id}-message`} className="sr-only">
              {t("label")}
            </label>
            <textarea
              id={`${id}-message`}
              required
              maxLength={2000}
              rows={4}
              value={message}
              placeholder={t("placeholder")}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-surface-1 w-full rounded-md border p-2 text-[16.25px]"
            />
            <div className="flex items-center justify-between gap-2">
              <p
                role="status"
                className={`text-xs ${status === "sent" ? "text-signal" : "text-danger"}`}
              >
                {status && t(status)}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  {t("close")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !message.trim()}
                >
                  {t("send")}
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}
      <Button
        size="sm"
        variant="secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="shadow-lg"
      >
        <MessageSquare aria-hidden />
        {t("open")}
      </Button>
    </div>
  );
}
