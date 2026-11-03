import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { currentUser } from "@/lib/auth/session";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, user] = await Promise.all([getLocale(), currentUser()]);
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AnalyticsProvider userId={user?.id ?? null} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
