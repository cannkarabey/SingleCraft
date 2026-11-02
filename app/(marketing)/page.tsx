import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExampleTabs } from "@/components/marketing/ExampleTabs";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/button";
import { listStories } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const PREVIEW_SIZE = 3;

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`space-y-6 py-12 ${className ?? ""}`}
    >
      <h2
        id={`${id}-title`}
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function Home() {
  const now = new Date();
  const [t, preview] = await Promise.all([
    getTranslations(),
    // The landing shows the real Discover feed (plan §8.2), not a screenshot.
    listStories(createPublicClient(), {
      range: "week",
      limit: PREVIEW_SIZE,
      now,
    }).catch(() => ({
      items: [],
      nextCursor: null,
    })),
  ]);

  const modules = ["discover", "radar", "studio"] as const;
  const steps = ["fetch", "dedupe", "cluster", "score", "brief"] as const;
  const faqs = ["accuracy", "copyright", "ai", "freshness"] as const;
  const plans = [
    { key: "free", features: ["a", "b", "c", "d"] },
    { key: "creator", features: ["a", "b", "c", "d"] },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4">
      <section className="py-20 sm:py-28">
        <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-[-0.03em] sm:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-lg">
          {t("hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/discover">{t("hero.primaryCta")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/discover">{t("hero.secondaryCta")}</Link>
          </Button>
        </div>
      </section>

      <Section id="preview" title={t("landing.preview.title")}>
        {preview.items.length === 0 ? (
          <p className="text-muted-foreground">{t("landing.preview.empty")}</p>
        ) : (
          <div className="space-y-3">
            {preview.items.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                now={now}
                actions={false}
                headingLevel={3}
              />
            ))}
          </div>
        )}
        <Button asChild variant="outline">
          <Link href="/discover">{t("landing.preview.cta")}</Link>
        </Button>
      </Section>

      <Section id="modules" title={t("landing.modules.title")}>
        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((m) => (
            <div key={m} className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold">
                {t(`landing.modules.${m}.title`)}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {t(`landing.modules.${m}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="problem" title={t("landing.problem.title")}>
        <p className="text-muted-foreground max-w-2xl text-lg">
          {t("landing.problem.body")}
        </p>
      </Section>

      <Section id="pipeline" title={t("landing.pipeline.title")}>
        <ol className="grid gap-3 sm:grid-cols-5">
          {steps.map((step, i) => (
            <li key={step} className="bg-card rounded-lg border p-4">
              <span className="text-signal font-mono text-xs">0{i + 1}</span>
              <p className="mt-1 text-sm">
                {t(`landing.pipeline.steps.${step}`)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="example" title={t("landing.example.title")}>
        <p className="text-muted-foreground text-sm">
          {t("landing.example.note")}
        </p>
        <ExampleTabs
          tabs={(["x", "linkedin", "shorts"] as const).map((key) => ({
            key,
            label: t(`landing.example.tabs.${key}`),
            body: t(`landing.example.${key}`),
          }))}
        />
      </Section>

      <Section id="pricing" title={t("landing.pricing.title")}>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className="bg-card flex flex-col rounded-lg border p-6"
            >
              <h3 className="font-semibold">
                {t(`landing.pricing.${plan.key}.name`)}
              </h3>
              <p className="mt-2">
                <span className="text-3xl font-semibold">
                  {t(`landing.pricing.${plan.key}.price`)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t("landing.pricing.perMonth")}
                </span>
              </p>
              <ul className="text-muted-foreground mt-4 flex-1 space-y-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f}>
                    {t(`landing.pricing.${plan.key}.features.${f}`)}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6"
                variant={plan.key === "creator" ? "default" : "outline"}
              >
                <Link href="/discover">{t("landing.pricing.cta")}</Link>
              </Button>
            </div>
          ))}
          <div className="flex flex-col rounded-lg border border-dashed p-6">
            <h3 className="font-semibold">{t("landing.pricing.pro.name")}</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("landing.pricing.pro.soon")}
            </p>
          </div>
        </div>
      </Section>

      <Section id="faq" title={t("landing.faq.title")}>
        <div className="divide-y rounded-lg border">
          {faqs.map((key) => (
            <details key={key} className="group p-4">
              <summary className="cursor-pointer font-medium">
                {t(`landing.faq.${key}.q`)}
              </summary>
              <p className="text-muted-foreground mt-2 text-sm">
                {t(`landing.faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Section>
    </main>
  );
}
