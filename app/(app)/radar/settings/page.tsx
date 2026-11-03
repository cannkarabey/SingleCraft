import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/PageHeader";
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
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("settingsTitle")} />
      <div className="mx-auto w-full max-w-xl space-y-6 p-6">
        <NicheForm
          key={niche.id}
          mode="settings"
          nicheId={niche.id}
          initial={{
            name: niche.name,
            keywords: niche.keywords,
            platforms: niche.platforms as (
              "x" | "linkedin" | "youtube" | "newsletter"
            )[],
            language: niche.language as "tr" | "en",
            tone: niche.tone as "analytical",
            excluded_keywords: niche.excluded_keywords,
            tracked_channels: niche.tracked_channels,
          }}
        />
      </div>
    </main>
  );
}
