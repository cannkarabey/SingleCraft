import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { NewBriefForm } from "@/components/studio/NewBriefForm";
import type { ControlsInput } from "@/lib/studio/controls";
import { TONES } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

const NICHE_PLATFORM: Record<string, ControlsInput["platform"]> = {
  x: "x",
  linkedin: "linkedin",
  youtube: "youtube_shorts",
  newsletter: "newsletter",
};

export default async function NewBriefPage({
  searchParams,
}: PageProps<"/studio/new">) {
  const story = z.uuid().safeParse((await searchParams).story);
  if (!story.success) notFound();
  const db = await createClient();
  const [{ data: row }, { data: niche }, t] = await Promise.all([
    db
      .from("stories")
      .select("id, title, summary")
      .eq("id", story.data)
      .maybeSingle(),
    db
      .from("niches")
      .select("platforms, tone")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    getTranslations("studio"),
  ]);
  if (!row) notFound();

  // Defaults from the user's niche (plan §8.2 onboarding answers).
  const platform = NICHE_PLATFORM[niche?.platforms?.[0] ?? "x"] ?? "x";
  const defaults: ControlsInput = {
    platform,
    format: platform === "x" ? "thread" : "post",
    tone: (TONES as readonly string[]).includes(niche?.tone ?? "")
      ? (niche!.tone as ControlsInput["tone"])
      : "analytical",
    audience: "",
    length: "medium",
    user_take: "",
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-10">
      <p className="text-muted-foreground text-sm">{t("newTitle")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{row.title}</h1>
      {row.summary && <p className="text-muted-foreground">{row.summary}</p>}
      <NewBriefForm storyId={row.id} defaults={defaults} />
    </main>
  );
}
