import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function UnsubscribedPage({
  searchParams,
}: PageProps<"/unsubscribed">) {
  const list = (await searchParams).list === "alerts" ? "alerts" : "digest";
  const t = await getTranslations("settings.unsubscribed");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-6 py-24">
      <h1 className="text-3xl font-[590] tracking-[-0.03em]">{t("title")}</h1>
      <p className="text-muted-foreground">{t(list)}</p>
      <Link
        href="/settings"
        className="text-muted-foreground hover:text-foreground text-[16.25px] underline"
      >
        {t("manage")}
      </Link>
    </main>
  );
}
