import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("hero");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("subtitle")}</p>
    </main>
  );
}
