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
    <main className="relative mx-auto w-full max-w-[1200px] flex-1 space-y-12 overflow-x-clip px-6 py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.045),transparent_65%)]"
      />
      <div className="space-y-4">
        <h1 className="text-4xl leading-[1.1] font-[590] tracking-[-0.03em] sm:text-6xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          {t("subtitle")}
        </p>
      </div>
      <PricingTable signedIn={Boolean(user && !user.anonymous)} />
    </main>
  );
}
