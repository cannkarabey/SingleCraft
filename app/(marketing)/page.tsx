import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppFrame } from "@/components/marketing/AppFrame";
import { ExampleTabs } from "@/components/marketing/ExampleTabs";
import { PricingTable } from "@/components/marketing/PricingTable";
import { currentUser } from "@/lib/auth/session";
import { StoryCard } from "@/components/story/StoryCard";
import { Button } from "@/components/ui/button";
import { listStories } from "@/lib/discover/queries";
import { createPublicClient } from "@/lib/supabase/public";

const PREVIEW_SIZE = 3;
const SOURCES = [
  "Hacker News",
  "GitHub",
  "Product Hunt",
  "arXiv",
  "Reddit",
  "RSS",
];

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
      className={`space-y-8 py-20 sm:py-24 ${className ?? ""}`}
    >
      <div className="space-y-3">
        <p className="text-text-tertiary font-mono text-xs tracking-wider uppercase">
          {label}
        </p>
        <h2
          id={`${id}-title`}
          className="max-w-3xl text-3xl leading-[1.1] font-[590] tracking-[-0.03em] sm:text-5xl"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Decorative mini-UI for a module card: a few rows or bars, never read by assistive tech. */
function MiniUi({ kind }: { kind: "discover" | "radar" | "studio" }) {
  const row = "bg-surface-3 h-2 rounded-full";
  return (
    <div
      aria-hidden
      className="bg-canvas/50 mb-5 h-28 space-y-2.5 overflow-hidden rounded-lg border p-3"
    >
      {kind === "discover" &&
        [90, 70, 80].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="bg-signal size-1.5 rounded-full" />
            <div className={row} style={{ width: `${w}%` }} />
          </div>
        ))}
      {kind === "radar" &&
        [
          ["bg-signal", 84],
          ["bg-warning", 62],
          ["bg-brand", 46],
        ].map(([dot, w], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`${dot} size-1.5 rounded-full`} />
            <div className={row} style={{ width: `${w}%` }} />
            <span className="text-text-tertiary ml-auto font-mono text-[10px]">
              {w}
            </span>
          </div>
        ))}
      {kind === "studio" &&
        [100, 85, 60].map((w, i) => (
          <div key={i} className={row} style={{ width: `${w}%` }} />
        ))}
    </div>
  );
}

export default async function Home() {
  const now = new Date();
  const [t, preview, user] = await Promise.all([
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
    currentUser(),
  ]);

  const modules = ["discover", "radar", "studio"] as const;
  const steps = ["fetch", "dedupe", "cluster", "score", "brief"] as const;
  const faqs = ["accuracy", "copyright", "ai", "freshness"] as const;

  return (
    <main className="relative mx-auto w-full max-w-[1200px] flex-1 overflow-x-clip px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(94,106,210,0.2),transparent_65%)]"
      />
      <section className="pt-20 pb-16 sm:pt-32">
        <Link
          href="/discover"
          className="bg-surface-2 text-muted-foreground hover:text-foreground mb-8 inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors duration-150"
        >
          {t("hero.badge")}
        </Link>
        <h1 className="max-w-4xl text-5xl leading-[1.05] font-[590] tracking-[-0.04em] sm:text-7xl">
          {t("hero.title")}
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-lg">
          {t("hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={user ? "/discover" : "/login?next=%2Fonboarding"}>
              {t("hero.primaryCta")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/discover">{t("hero.secondaryCta")}</Link>
          </Button>
        </div>
      </section>

      <Section
        id="preview"
        label={t("landing.labels.preview")}
        title={t("landing.preview.title")}
        className="pt-8"
      >
        <AppFrame active="discover">
          {preview.items.length === 0 ? (
            <p className="text-muted-foreground p-4">
              {t("landing.preview.empty")}
            </p>
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
        </AppFrame>
        <Button asChild variant="outline">
          <Link href="/discover">{t("landing.preview.cta")}</Link>
        </Button>
      </Section>

      <div className="text-text-tertiary flex flex-wrap items-center gap-x-8 gap-y-2 border-y py-6 text-[13px]">
        <p>{t("landing.sources.label")}</p>
        <ul className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
          {SOURCES.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>

      <Section
        id="modules"
        label={t("landing.labels.modules")}
        title={t("landing.modules.title")}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((m, i) => (
            <div key={m} className="bg-surface-1 rounded-xl border p-6">
              <MiniUi kind={m} />
              <p className="text-text-tertiary mb-2 font-mono text-xs">
                {`${i + 1}.0 ${t(`landing.modules.${m}.title`)}`}
              </p>
              <h3 className="text-lg font-[590] tracking-tight">
                {t(`landing.modules.${m}.title`)}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {t(`landing.modules.${m}.body`)}
              </p>
            </div>
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
        <ol className="grid gap-px overflow-hidden rounded-xl border bg-[var(--sc-border)] sm:grid-cols-5">
          {steps.map((step, i) => (
            <li key={step} className="bg-surface-1 p-5">
              <span className="text-brand font-mono text-xs">0{i + 1}</span>
              <p className="mt-3 text-sm">
                {t(`landing.pipeline.steps.${step}`)}
              </p>
            </li>
          ))}
        </ol>
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
        id="pricing"
        label={t("landing.labels.pricing")}
        title={t("landing.pricing.title")}
      >
        <PricingTable signedIn={Boolean(user)} headingLevel={3} />
      </Section>

      <Section
        id="faq"
        label={t("landing.labels.faq")}
        title={t("landing.faq.title")}
      >
        <div className="divide-y overflow-hidden rounded-xl border">
          {faqs.map((key) => (
            <details key={key} className="group bg-surface-1 p-5">
              <summary className="cursor-pointer font-medium">
                {t(`landing.faq.${key}.q`)}
              </summary>
              <p className="text-muted-foreground mt-3 text-sm">
                {t(`landing.faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <section
        id="cta"
        aria-labelledby="cta-title"
        className="relative my-12 overflow-hidden rounded-2xl border px-6 py-20 text-center sm:py-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(94,106,210,0.22),transparent_70%)]"
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
          <Button asChild size="lg">
            <Link href={user ? "/discover" : "/login?next=%2Fonboarding"}>
              {t("hero.primaryCta")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/discover">{t("hero.secondaryCta")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
