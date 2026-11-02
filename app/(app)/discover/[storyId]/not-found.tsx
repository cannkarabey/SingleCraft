import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function StoryNotFound() {
  const t = await getTranslations("story");
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-16">
      <p className="text-lg">{t("notFound")}</p>
      <Link
        href="/discover"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← {t("back")}
      </Link>
    </main>
  );
}
