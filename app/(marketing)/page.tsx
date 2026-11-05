import { Check } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AppFrame } from "@/components/marketing/AppFrame";
import { ExampleTabs } from "@/components/marketing/ExampleTabs";
import { LiveDemo } from "@/components/marketing/LiveDemo";
import { LogoMarquee } from "@/components/marketing/LogoMarquee";
import { ModuleCard } from "@/components/marketing/ModuleCard";
import { PipelineSteps } from "@/components/marketing/PipelineSteps";
import { Reveal } from "@/components/marketing/Reveal";
import { currentUser } from "@/lib/auth/session";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/button";
import { listStories } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const PREVIEW_SIZE = 3;

function Section({
  id,
  label,
  title,
  children,
  className,
}: {
  id: string;
  label: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`space-y-10 py-20 sm:py-28 ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="mb-10 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
      <Reveal className="space-y-3">
        <p className="text-brand-text font-mono text-xs tracking-wider uppercase">
          {label}
        </p>
        <h2
          id={`${id}-title`}
          className="max-w-3xl text-3xl leading-[1.1] font-[590] tracking-[-0.03em] sm:text-5xl"
        >
          {title}
        </h2>
      </Reveal>
      <Reveal delay={120} className="space-y-8">
        {children}
      </Reveal>
    </section>
  );
}

/** Floating signal chips beside the hero copy; decorative only. */
function HeroChips({ high, brief }: { high: string; brief: string }) {
  const chip =
    "bg-surface-1/80 border-border-strong flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] shadow-[0_16px_48px_-16px_rgba(0,0,0,0.8)] backdrop-blur";
  return (
    <div
      aria-hidden
      className="pointer-events-none relative hidden h-80 lg:block"
    >
      <div className={`${chip} animate-float absolute top-2 left-4`}>
        <span className="bg-signal size-2 rounded-full" />
        {high}
        <span className="text-signal font-mono text-xs">91</span>
      </div>
      <div
        className={`${chip} animate-float absolute top-28 right-0`}
        style={{ animationDelay: "-2.4s" }}
      >
        <span className="bg-warning size-2 rounded-full" />
        <span className="bg-surface-3 h-2 w-24 rounded-full" />
        <span className="text-warning font-mono text-xs">66</span>
      </div>
      <div
        className={`${chip} animate-float absolute bottom-4 left-12`}
        style={{ animationDelay: "-4.6s" }}
      >
        <span className="bg-signal/20 text-signal grid size-5 place-items-center rounded-full">
          <Check className="size-3" />
        </span>
        {brief}
      </div>
    </div>
  );
}

export default async function Home() {
  const now = new Date();
  const [t, locale, preview, user] = await Promise.all([
    getTranslations(),
    getLocale(),
    // The landing shows the real Discover feed (plan §8.2), not a screenshot.
    listStories(createPublicClient(), {
      range: "week",
      limit: PREVIEW_SIZE,
      now,
    }).catch(() => ({
      items: [],
      nextCursor: null,
    })),
    currentUser(),
  ]);

  const modules = ["discover", "radar", "studio"] as const;
  const steps = ["fetch", "dedupe", "cluster", "score", "brief"] as const;
  const faqs = ["accuracy", "copyright", "ai", "freshness"] as const;
  const member = Boolean(user && !user.anonymous);
  const imageLocale = locale === "en" ? "en" : "tr";

  return (
    <main className="relative mx-auto w-full max-w-[1200px] flex-1 overflow-x-clip px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden"
      >
        <div className="animate-drift absolute -top-40 left-[8%] h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.2),transparent)] blur-2xl" />
        <div
          className="animate-drift absolute top-10 right-[4%] h-[380px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.1),transparent)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <section className="grid items-center gap-10 pt-20 pb-16 sm:pt-28 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <Link
            href="/discover"
            className="animate-rise bg-surface-2/80 text-muted-foreground hover:text-foreground hover:border-border-strong group mb-8 inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] backdrop-blur transition-all duration-300"
          >
            <span className="bg-signal animate-pulse-ring size-1.5 rounded-full" />
            {t("hero.badge")}
          </Link>
          <h1
            className="animate-rise text-shimmer max-w-4xl text-5xl leading-[1.05] font-[590] tracking-[-0.04em] sm:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            {t("hero.title")}
          </h1>
          <p
            className="animate-rise text-muted-foreground mt-6 max-w-xl text-lg"
            style={{ animationDelay: "180ms" }}
          >
            {t("hero.subtitle")}
          </p>
          <div
            className="animate-rise mt-10 flex flex-wrap gap-3"
            style={{ animationDelay: "280ms" }}
          >
            <Button asChild size="lg" variant="brand" className="rounded-full">
              <Link href="/discover">{t("hero.primaryCta")}</Link>
            </Button>
            {!member && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link href="/signup?next=%2Fonboarding">
                  {t("hero.secondaryCta")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        <HeroChips high={t("hero.chipHigh")} brief={t("hero.chipBrief")} />
      </section>

      <Section
        id="preview"
        label={t("landing.labels.preview")}
        title={t("landing.preview.title")}
        className="pt-8"
      >
        <LiveDemo
          discover={
            preview.items.length === 0 ? (
              <p className="text-muted-foreground p-4">
                {t("landing.preview.empty")}
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
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
            )
          }
        />
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/discover">{t("landing.preview.cta")}</Link>
        </Button>
      </Section>

      <LogoMarquee label={t("landing.sources.label")} />

      <Section
        id="modules"
        label={t("landing.labels.modules")}
        title={t("landing.modules.title")}
      >
        <div className="grid gap-5 md:grid-cols-3">
          {modules.map((m, i) => (
            <Reveal key={m} delay={i * 110}>
              <ModuleCard
                href={`/${m}`}
                caption={`${i + 1}.0 ${t(`landing.modules.${m}.title`)}`}
                title={t(`landing.modules.${m}.title`)}
                body={t(`landing.modules.${m}.body`)}
                open={t("landing.modules.open")}
                image={`/marketing/${m}-${imageLocale}.webp`}
                alt={t("landing.modules.imageAlt", {
                  name: t(`landing.modules.${m}.title`),
                })}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        id="problem"
        label={t("landing.labels.problem")}
        title={t("landing.problem.title")}
      >
        <p className="text-muted-foreground max-w-2xl text-lg">
          {t("landing.problem.body")}
        </p>
      </Section>

      <Section
        id="pipeline"
        label={t("landing.labels.pipeline")}
        title={t("landing.pipeline.title")}
      >
        <PipelineSteps
          steps={steps.map((step) => ({
            key: step,
            title: t(`landing.pipeline.steps.${step}`),
            detail: t(`landing.pipeline.details.${step}`),
          }))}
        />
      </Section>

      <Section
        id="example"
        label={t("landing.labels.example")}
        title={t("landing.example.title")}
      >
        <p className="text-muted-foreground text-sm">
          {t("landing.example.note")}
        </p>
        <AppFrame active="studio">
          <ExampleTabs
            tabs={(["x", "linkedin", "shorts"] as const).map((key) => ({
              key,
              label: t(`landing.example.tabs.${key}`),
              body: t(`landing.example.${key}`),
            }))}
          />
        </AppFrame>
      </Section>

      <Section
        id="faq"
        label={t("landing.labels.faq")}
        title={t("landing.faq.title")}
      >
        <div className="divide-y overflow-hidden rounded-xl border">
          {faqs.map((key) => (
            <details
              key={key}
              className="group surface-gradient bg-surface-1 hover:bg-surface-2/60 p-5 transition-colors duration-200"
            >
              <summary className="cursor-pointer font-medium">
                {t(`landing.faq.${key}.q`)}
              </summary>
              <p className="text-muted-foreground animate-panel-in mt-3 text-sm">
                {t(`landing.faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <Reveal as="section" className="my-12">
        <div
          id="cta"
          aria-labelledby="cta-title"
          role="region"
          className="group relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.1] via-white/[0.03] to-transparent px-6 py-20 text-center transition-colors duration-500 hover:border-white/20 sm:py-28"
        >
          <div
            aria-hidden
            className="animate-drift pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.14),transparent)] blur-2xl"
          />
          <h2
            id="cta-title"
            className="relative mx-auto max-w-2xl text-4xl leading-[1.1] font-[590] tracking-[-0.03em] sm:text-5xl"
          >
            {t("landing.cta.title")}
          </h2>
          <p className="text-muted-foreground relative mx-auto mt-4 max-w-md">
            {t("landing.cta.body")}
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="brand" className="rounded-full">
              <Link href="/discover">{t("hero.primaryCta")}</Link>
            </Button>
            {!member && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link href="/signup?next=%2Fonboarding">
                  {t("hero.secondaryCta")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Reveal>
    </main>
  );
}
