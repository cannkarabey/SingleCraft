"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import type { BriefDetail } from "@/lib/studio/briefs";
import type { ControlsInput } from "@/lib/studio/controls";
import { tweetLength, type BriefOutput } from "@/lib/studio/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ControlFields } from "./ControlFields";

type Editable = Partial<
  Pick<
    BriefOutput,
    | "x_thread"
    | "linkedin_post"
    | "shorts_hooks"
    | "shorts_script"
    | "newsletter_section"
    | "blog_draft"
  >
>;
type Tab = "x" | "linkedin" | "shorts" | "newsletter" | "blog";
const TABS: Tab[] = ["x", "linkedin", "shorts", "newsletter", "blog"];
const AUTOSAVE_MS = 800;
const POLL_MS = 3000;
const SAFE_URL = /^https?:\/\//i;

const area =
  "w-full rounded-md border border-transparent bg-surface-2 p-3 text-[13px] leading-relaxed focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function controlsOf(b: BriefDetail): ControlsInput {
  return {
    platform: b.platform as ControlsInput["platform"],
    format: b.format as ControlsInput["format"],
    tone: b.tone as ControlsInput["tone"],
    audience: b.audience ?? "",
    length: (b.length ?? "medium") as ControlsInput["length"],
    user_take: b.user_take ?? "",
  };
}

/**
 * Studio editor (plan §8.2): waits for generation (Realtime with a polling fallback), then
 * edits the user's copy with autosave; versions, regenerate, copy and "Yayınladım".
 */
export function BriefEditor({ initial }: { initial: BriefDetail }) {
  const t = useTranslations("studio");
  const [brief, setBrief] = useState(initial);
  const [edited, setEdited] = useState<Editable>(
    (initial.edited as Editable) ?? {},
  );
  const [hook, setHook] = useState<number | null>(initial.selected_hook);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [tab, setTab] = useState<Tab>("x");
  const [controls, setControls] = useState(controlsOf(initial));
  const [publishUrl, setPublishUrl] = useState(initial.published_url ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = useRef(false);

  const output = brief.output as BriefOutput | null;
  const content = output ? { ...output, ...edited } : null;
  const ready = brief.status === "ready" && content !== null;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/studio/briefs/${brief.id}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const next = (await res.json()) as BriefDetail;
    setBrief(next);
    if (next.status === "ready" && !dirty.current) {
      setEdited((next.edited as Editable) ?? {});
      setHook(next.selected_hook);
    }
  }, [brief.id]);

  // Realtime status updates (RLS-scoped), with polling as a fallback while waiting.
  useEffect(() => {
    if (brief.status === "ready" || brief.status === "failed") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`brief-${brief.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "briefs",
          filter: `id=eq.${brief.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [brief.id, brief.status, refresh]);

  const persist = useCallback(
    async (nextEdited: Editable, nextHook: number | null) => {
      setSave("saving");
      try {
        const res = await fetch(`/api/studio/briefs/${brief.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ edited: nextEdited, selected_hook: nextHook }),
        });
        setSave(res.ok ? "saved" : "error");
        if (res.ok) dirty.current = false;
      } catch {
        setSave("error");
      }
    },
    [brief.id],
  );

  // Debounced autosave of edits and the chosen hook.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => void persist(edited, hook), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [edited, hook, persist]);

  const change = (patch: Editable) => {
    dirty.current = true;
    setSave("idle");
    setEdited((e) => ({ ...e, ...patch }));
  };
  const chooseHook = (i: number) => {
    dirty.current = true;
    setHook(i);
  };

  const regenerate = () =>
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/studio/briefs/${brief.id}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(controls),
      }).catch(() => null);
      if (res?.status === 202) {
        dirty.current = false;
        setBrief((b) => ({ ...b, status: "queued" }));
      } else {
        setError(res?.status === 429 ? t("errors.limit") : t("errors.generic"));
      }
    });

  const publish = () =>
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/studio/briefs/${brief.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: publishUrl.trim() || null }),
      }).catch(() => null);
      if (res?.ok)
        setBrief((b) => ({
          ...b,
          published_at: new Date().toISOString(),
          published_url: publishUrl || null,
        }));
      else setError(t("errors.generic"));
    });

  const restore = (version: BriefOutput) =>
    change({
      x_thread: version.x_thread,
      linkedin_post: version.linkedin_post,
      shorts_hooks: version.shorts_hooks,
      shorts_script: version.shorts_script,
      newsletter_section: version.newsletter_section,
      blog_draft: version.blog_draft,
    });

  const tabText = (): string => {
    if (!content) return "";
    switch (tab) {
      case "x":
        return content.x_thread.join("\n\n");
      case "linkedin":
        return content.linkedin_post;
      case "shorts":
        return [
          content.shorts_script.hook,
          ...content.shorts_script.beats,
          content.shorts_script.cta,
        ].join("\n");
      case "newsletter":
        return content.newsletter_section;
      case "blog":
        return content.blog_draft;
    }
  };

  const statusText = !ready
    ? t(`status.${brief.status}`)
    : save === "saving"
      ? t("editor.saving")
      : save === "saved"
        ? t("editor.saved")
        : save === "error"
          ? t("errors.generic")
          : "";

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={brief.stories?.title ?? ""}
        actions={
          <p
            role="status"
            className="text-text-tertiary min-h-5 font-mono text-xs"
          >
            {statusText}
          </p>
        }
      />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6 p-4 sm:p-6">
          {(brief.status === "failed" || error) && (
            <div className="space-y-1">
              {brief.status === "failed" && (
                <p className="text-danger text-sm">{t("status.failed")}</p>
              )}
              {error && (
                <p role="alert" className="text-danger text-sm">
                  {error}
                </p>
              )}
            </div>
          )}

          {ready && content && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-[13px] font-medium">
                  {t("editor.hooks")}
                </legend>
                {content.hooks.map((h, i) => (
                  <label key={i} className="flex items-start gap-2 text-[13px]">
                    <input
                      type="radio"
                      name="hook"
                      checked={hook === i}
                      onChange={() => chooseHook(i)}
                      className="mt-1"
                    />
                    <span>{h}</span>
                  </label>
                ))}
              </fieldset>

              <section className="space-y-2">
                <h2 className="text-[13px] font-medium">
                  {t("editor.titles")}
                </h2>
                <ul className="text-muted-foreground list-disc pl-5 text-[13px]">
                  {content.titles.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <div
                  role="tablist"
                  className="flex flex-wrap gap-1 border-b pb-1"
                >
                  {TABS.map((key) => (
                    <button
                      key={key}
                      role="tab"
                      type="button"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-[13px] transition-colors duration-150",
                        tab === key
                          ? "bg-surface-3 text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`editor.tabs.${key}`)}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" className="space-y-3">
                  {tab === "x" &&
                    content.x_thread.map((tweet, i) => {
                      const length = tweetLength(tweet);
                      return (
                        <label key={i} className="block space-y-1 text-sm">
                          <span className="sr-only">
                            {t("editor.tweet", { n: i + 1 })}
                          </span>
                          <textarea
                            aria-label={t("editor.tweet", { n: i + 1 })}
                            className={cn(area, "min-h-20")}
                            value={tweet}
                            onChange={(e) =>
                              change({
                                x_thread: content.x_thread.map((tw, j) =>
                                  j === i ? e.target.value : tw,
                                ),
                              })
                            }
                          />
                          <span
                            className={cn(
                              "block text-right font-mono text-xs",
                              length > 280
                                ? "text-danger"
                                : "text-muted-foreground",
                            )}
                          >
                            {length}/280
                          </span>
                        </label>
                      );
                    })}
                  {tab === "linkedin" && (
                    <textarea
                      aria-label={t("editor.linkedin")}
                      className={cn(area, "min-h-56")}
                      value={content.linkedin_post}
                      onChange={(e) =>
                        change({ linkedin_post: e.target.value })
                      }
                    />
                  )}
                  {tab === "shorts" && (
                    <>
                      <textarea
                        aria-label={t("editor.shortsHooks")}
                        className={cn(area, "min-h-24")}
                        value={content.shorts_hooks.join("\n")}
                        onChange={(e) =>
                          change({ shorts_hooks: e.target.value.split("\n") })
                        }
                      />
                      <textarea
                        aria-label={t("editor.shortsScript")}
                        className={cn(area, "min-h-40")}
                        value={[
                          content.shorts_script.hook,
                          ...content.shorts_script.beats,
                          content.shorts_script.cta,
                        ].join("\n")}
                        onChange={(e) => {
                          const lines = e.target.value.split("\n");
                          change({
                            shorts_script: {
                              ...content.shorts_script,
                              hook: lines[0] ?? "",
                              beats: lines.slice(1, -1),
                              cta:
                                lines.length > 1 ? lines[lines.length - 1] : "",
                            },
                          });
                        }}
                      />
                    </>
                  )}
                  {tab === "newsletter" && (
                    <textarea
                      aria-label={t("editor.newsletter")}
                      className={cn(area, "min-h-40")}
                      value={content.newsletter_section}
                      onChange={(e) =>
                        change({ newsletter_section: e.target.value })
                      }
                    />
                  )}
                  {tab === "blog" && (
                    <textarea
                      aria-label={t("editor.blog")}
                      className={cn(area, "min-h-80 font-mono")}
                      value={content.blog_draft}
                      onChange={(e) => change({ blog_draft: e.target.value })}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void persist(edited, hook)}
                  >
                    {t("editor.save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(tabText());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? t("editor.copied") : t("editor.copy")}
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-[13px] font-medium">
                  {t("editor.sources")}
                </h2>
                <ul className="space-y-1 text-[13px]">
                  {content.sources.map((s) => (
                    <li key={s.url}>
                      {SAFE_URL.test(s.url) ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="hover:underline"
                        >
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}{" "}
                      <span className="text-muted-foreground font-mono text-xs">
                        · {s.source}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium">{t("editor.disclosure")}:</span>{" "}
                  {content.ai_disclosure}
                </p>
              </section>
            </>
          )}
        </div>

        <aside className="space-y-6 border-t p-4 lg:border-t-0 lg:border-l">
          <section className="space-y-3">
            <h2 className="text-[13px] font-medium">{t("controls.title")}</h2>
            <ControlFields value={controls} onChange={setControls} />
            <Button
              className="w-full"
              variant="outline"
              onClick={regenerate}
              disabled={pending || !ready}
            >
              {t("controls.regenerate")}
            </Button>
          </section>

          {ready && (
            <section className="space-y-3 border-t pt-6">
              {brief.published_at ? (
                <p className="text-signal text-[13px]">{t("publish.done")}</p>
              ) : (
                <>
                  <label className="block space-y-1 text-[13px]">
                    <span className="text-muted-foreground">
                      {t("publish.url")}
                    </span>
                    <input
                      type="url"
                      maxLength={500}
                      value={publishUrl}
                      onChange={(e) => setPublishUrl(e.target.value)}
                      className="bg-surface-2 h-8 w-full rounded-md border px-2 text-[13px]"
                    />
                  </label>
                  <Button
                    className="w-full"
                    onClick={publish}
                    disabled={pending}
                  >
                    {t("publish.cta")}
                  </Button>
                </>
              )}
            </section>
          )}

          {brief.versions.length > 1 && (
            <section className="space-y-2 border-t pt-6">
              <h2 className="text-[13px] font-medium">
                {t("editor.versions")}
              </h2>
              <ul className="space-y-1 text-[13px]">
                {brief.versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-xs">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restore(v.output as BriefOutput)}
                    >
                      {t("editor.restore")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
