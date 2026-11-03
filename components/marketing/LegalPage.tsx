import { getTranslations } from "next-intl/server";

/** A long-form legal page: title, update date and numbered sections from messages. */
export async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const t = await getTranslations(`legal.${doc}`);
  const sections = Object.keys(
    (t.raw("sections") as Record<string, unknown>) ?? {},
  );
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-6 py-20 sm:py-28">
      <header className="space-y-3">
        <h1 className="text-4xl leading-[1.1] font-[590] tracking-[-0.03em] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-text-tertiary font-mono text-xs">{t("updated")}</p>
      </header>
      <div className="space-y-8">
        {sections.map((key, i) => (
          <section key={key} className="space-y-2">
            <h2 className="text-lg font-[590] tracking-tight">
              {i + 1}. {t(`sections.${key}.title`)}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t(`sections.${key}.body`)}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
