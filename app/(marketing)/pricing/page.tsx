import { getTranslations } from "next-intl/server";
import { PricingTable } from "@/components/marketing/PricingTable";
import { currentUser } from "@/lib/auth/session";

export async function generateMetadata() {
  const t = await getTranslations("pricing");
  return { title: t("title") };
}

export default async function PricingPage() {
  const [t, user] = await Promise.all([
    getTranslations("pricing"),
    currentUser(),
  ]);
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <PricingTable signedIn={Boolean(user)} />
    </main>
  );
}
