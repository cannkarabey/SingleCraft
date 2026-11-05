import Link from "next/link";
import { Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";

const heading = "text-text-tertiary mb-4 text-xs font-medium";
const link =
  "text-muted-foreground hover:text-foreground text-[16.25px] transition-colors duration-150";

export async function Footer() {
  const [t, nav] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
  ]);
  const groups = [
    {
      label: t("product"),
      links: [
        { href: "/discover", text: nav("discover") },
        { href: "/radar", text: nav("radar") },
        { href: "/studio", text: nav("studio") },
      ],
    },
    {
      label: t("account"),
      links: [
        { href: "/login", text: nav("signIn") },
        { href: "/signup", text: nav("signUp") },
      ],
    },
    {
      label: t("legal"),
      links: [
        { href: "/privacy", text: t("privacy") },
        { href: "/terms", text: t("terms") },
      ],
    },
  ];
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-12 px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="flex items-center gap-2 text-[18.75px] font-[590] tracking-tight">
            <Radio aria-hidden className="text-brand size-4" />
            SignalCraft
          </p>
          <p className="text-muted-foreground max-w-xs text-[16.25px]">
            {t("tagline")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-x-20 gap-y-10">
          {groups.map(({ label, links }) => (
            <nav key={label} aria-label={label}>
              <p className={heading}>{label}</p>
              <ul className="space-y-2.5">
                {links.map(({ href, text }) => (
                  <li key={href}>
                    <Link href={href} className={link}>
                      {text}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t">
        <p className="text-text-tertiary mx-auto w-full max-w-[1200px] px-6 py-6 text-center font-mono text-xs">
          {t("copyright", { year: new Date().getFullYear() })} · {t("rights")}
        </p>
      </div>
    </footer>
  );
}
