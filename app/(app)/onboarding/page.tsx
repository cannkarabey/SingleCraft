import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/PageHeader";
import { NicheForm } from "@/components/radar/NicheForm";
import { listNiches } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const niches = await listNiches(await createClient());
  if (niches.length > 0) redirect("/radar");
  const t = await getTranslations("onboarding");
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-xl space-y-6 p-6">
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <NicheForm mode="wizard" />
      </div>
    </main>
  );
}
