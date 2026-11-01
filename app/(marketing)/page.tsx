import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const t = await getTranslations("hero");
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-24">
      <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-[-0.03em] sm:text-6xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground mt-6 max-w-2xl text-lg">
        {t("subtitle")}
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/discover">{t("primaryCta")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/discover">{t("secondaryCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
