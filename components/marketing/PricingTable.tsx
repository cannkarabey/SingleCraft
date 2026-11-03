import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS, PLAN_PRICE_USD, type Plan } from "@/lib/billing/limits";

/** Pricing cards generated from PLAN_LIMITS so copy and enforcement never disagree. */
export async function PricingTable({
  signedIn,
  headingLevel = 2,
}: {
  signedIn: boolean;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations("pricing");
  const Heading = headingLevel === 2 ? "h2" : "h3";

  const features = (plan: Plan) => {
    const l = PLAN_LIMITS[plan];
    return [
      t("features.discover"),
      l.radarRows === null
        ? t("features.radarUnlimited")
        : t("features.radarRows", { count: l.radarRows }),
      t("features.niches", { count: l.niches }),
      l.briefsPerDay === null
        ? t("features.briefsUnlimited")
        : t("features.briefs", { count: l.briefsPerDay }),
      ...(l.anglesPerDay
        ? [t("features.angles", { count: l.anglesPerDay })]
        : []),
      ...(l.digest ? [t("features.digest")] : []),
    ];
  };

  const plans: { plan: Plan; cta: React.ReactNode }[] = [
    {
      plan: "free",
      cta: (
        <Button asChild variant="outline" size="lg" className="mt-8">
          <Link href={signedIn ? "/radar" : "/signup?next=%2Fonboarding"}>
            {t("freeCta")}
          </Link>
        </Button>
      ),
    },
    {
      plan: "creator",
      cta: (
        <Button asChild size="lg" variant="brand" className="mt-8">
          <Link
            href={signedIn ? "/settings#billing" : "/signup?next=%2Fsettings"}
          >
            {t("upgradeCta")}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map(({ plan, cta }) => (
        <article
          key={plan}
          className={`bg-surface-1 relative flex flex-col overflow-hidden rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_24px_64px_-24px_rgba(255,255,255,0.168)] ${plan === "creator" ? "border-border-strong" : ""}`}
        >
          {plan === "creator" && (
            <span
              aria-hidden
              className="bg-brand absolute inset-x-0 top-0 h-px"
            />
          )}
          <Heading className="font-[590] capitalize">
            {plan === "free" ? "Free" : "Creator"}
          </Heading>
          <p className="mt-2">
            <span className="text-4xl font-[590] tracking-tight">
              ${PLAN_PRICE_USD[plan]}
            </span>
            <span className="text-muted-foreground text-sm">
              {t("perMonth")}
            </span>
          </p>
          <ul className="text-muted-foreground mt-6 flex-1 space-y-2.5 text-sm">
            {features(plan).map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check aria-hidden className="text-signal size-3.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {cta}
        </article>
      ))}
      <article className="flex flex-col rounded-xl border border-dashed p-6">
        <Heading className="font-[590]">Pro</Heading>
        <p className="text-muted-foreground mt-2 text-sm">{t("soon")}</p>
      </article>
    </div>
  );
}
