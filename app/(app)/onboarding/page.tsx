import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NicheForm } from "@/components/radar/NicheForm";
import { listNiches } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const niches = await listNiches(await createClient());
  if (niches.length > 0) redirect("/radar");
  const t = await getTranslations("onboarding");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <NicheForm mode="wizard" />
    </main>
  );
}
