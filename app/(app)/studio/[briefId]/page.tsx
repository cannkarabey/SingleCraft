import { notFound } from "next/navigation";
import { z } from "zod";
import { BriefEditor } from "@/components/studio/BriefEditor";
import { getBrief } from "@/lib/studio/briefs";
import { createClient } from "@/lib/supabase/server";

export default async function BriefPage({
  params,
}: PageProps<"/studio/[briefId]">) {
  const id = z.uuid().safeParse((await params).briefId);
  if (!id.success) notFound();
  const brief = await getBrief(await createClient(), id.data);
  if (!brief) notFound();
  return <BriefEditor initial={brief} />;
}
