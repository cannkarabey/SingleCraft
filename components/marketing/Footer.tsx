import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";

const heading = "text-text-tertiary mb-4 text-xs font-medium";
const link =
  "text-muted-foreground hover:text-foreground text-[13px] transition-colors duration-150";

export async function Footer() {
  const [t, nav] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
  ]);
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[15px] font-[590] tracking-tight">
            <Radio aria-hidden className="text-brand size-4" />
            SignalCraft
          </p>
          <p className="text-muted-foreground max-w-xs text-[13px]">
            {t("tagline")}
          </p>
        </div>
        <nav aria-label={t("product")}>
          <p className={heading}>{t("product")}</p>
          <ul className="space-y-2.5">
            {(["discover", "radar", "studio"] as const).map((key) => (
              <li key={key}>
                <Link href={`/${key}`} className={link}>
                  {nav(key)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/pricing" className={link}>
                {nav("pricing")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={t("resources")}>
          <p className={heading}>{t("resources")}</p>
          <ul className="space-y-2.5">
            <li>
              <Link href="/login" className={link}>
                {nav("signIn")}
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className={heading}>{t("legal")}</p>
          <p className="text-muted-foreground text-[13px]">{t("legalSoon")}</p>
        </div>
      </div>
      <div className="border-t">
        <p className="text-text-tertiary mx-auto w-full max-w-[1200px] px-6 py-6 font-mono text-xs">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
