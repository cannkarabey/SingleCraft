import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/marketing/LegalPage";

export async function generateMetadata() {
  const t = await getTranslations("legal.terms");
  return { title: t("title") };
}

export default function Page() {
  return <LegalPage doc="terms" />;
}
