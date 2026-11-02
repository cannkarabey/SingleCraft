import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NicheForm } from "@/components/radar/NicheForm";
import { listNiches } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

export default async function RadarSettingsPage({
  searchParams,
}: PageProps<"/radar/settings">) {
  const niches = await listNiches(await createClient());
  if (niches.length === 0) redirect("/onboarding");
  const wanted = (await searchParams).niche;
  const niche = niches.find((n) => n.id === wanted) ?? niches[0];
  const t = await getTranslations("niche");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("settingsTitle")}
      </h1>
      <NicheForm
        key={niche.id}
        mode="settings"
        nicheId={niche.id}
        initial={{
          name: niche.name,
          keywords: niche.keywords,
          platforms: niche.platforms as ("x" | "linkedin" | "youtube" | "newsletter")[],
          language: niche.language as "tr" | "en",
          tone: niche.tone as "analytical",
          excluded_keywords: niche.excluded_keywords,
          tracked_channels: niche.tracked_channels,
        }}
      />
    </main>
  );
}
