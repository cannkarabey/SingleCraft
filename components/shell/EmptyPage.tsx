import { getTranslations } from "next-intl/server";

export async function EmptyPage({
  namespace,
}: {
  namespace: "discover" | "radar" | "studio";
}) {
  const t = await getTranslations(namespace);
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="bg-card text-muted-foreground mt-6 rounded-lg border p-6">
        {t("empty")}
      </p>
    </main>
  );
}
