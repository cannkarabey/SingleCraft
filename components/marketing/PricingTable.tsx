import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
        <Button asChild variant="outline" className="mt-6">
          <Link href={signedIn ? "/radar" : "/login?next=%2Fonboarding"}>
            {t("freeCta")}
          </Link>
        </Button>
      ),
    },
    {
      plan: "creator",
      cta: (
        <Button asChild className="mt-6">
          <Link
            href={signedIn ? "/settings#billing" : "/login?next=%2Fsettings"}
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
          className="bg-card flex flex-col rounded-lg border p-6"
        >
          <Heading className="font-semibold capitalize">
            {plan === "free" ? "Free" : "Creator"}
          </Heading>
          <p className="mt-2">
            <span className="text-3xl font-semibold">
              ${PLAN_PRICE_USD[plan]}
            </span>
            <span className="text-muted-foreground text-sm">
              {t("perMonth")}
            </span>
          </p>
          <ul className="text-muted-foreground mt-4 flex-1 space-y-1.5 text-sm">
            {features(plan).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {cta}
        </article>
      ))}
      <article className="flex flex-col rounded-lg border border-dashed p-6">
        <Heading className="font-semibold">Pro</Heading>
        <p className="text-muted-foreground mt-2 text-sm">{t("soon")}</p>
      </article>
    </div>
  );
}
