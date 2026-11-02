import { redirect } from "next/navigation";
import { EmptyPage } from "@/components/shell/EmptyPage";
import { listNiches } from "@/lib/radar/niches";
import { createClient } from "@/lib/supabase/server";

export default async function RadarPage() {
  const niches = await listNiches(await createClient());
  if (niches.length === 0) redirect("/onboarding");
  return <EmptyPage namespace="radar" />;
}
