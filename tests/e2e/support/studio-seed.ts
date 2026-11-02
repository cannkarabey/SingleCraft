import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function admin() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
}

/** A published story with two sources (links the brief must carry exactly). */
export async function seedStudioStory() {
  const db = admin();
  const tag = randomUUID().slice(0, 6);
  const sources = [
    {
      id: randomUUID(),
      name: `Studio blog ${tag}`,
      type: "rss",
      url: `https://studio.e2e.test/rss/${tag}`,
    },
    {
      id: randomUUID(),
      name: `Studio HN ${tag}`,
      type: "hn",
      url: `https://studio.e2e.test/hn/${tag}`,
    },
  ];
  const { error: sErr } = await db.from("sources").insert(sources);
  if (sErr) throw sErr;
  const { data: story, error } = await db
    .from("stories")
    .insert({
      status: "published",
      title: `Studio story ${tag}`,
      summary: "A short summary.",
      why_it_matters: "It matters.",
      first_seen_at: new Date().toISOString(),
    })
    .select("id, title")
    .single();
  if (error) throw error;
  const links: { title: string; url: string; source: string }[] = [];
  for (const [i, src] of sources.entries()) {
    const url = `https://news.e2e.test/${tag}/${i}`;
    const { data: item, error: iErr } = await db
      .from("raw_items")
      .insert({
        source_id: src.id,
        external_id: `${tag}-${i}`,
        url,
        canonical_url: url,
        title: `Original report ${i} ${tag}`,
        content_hash: `${tag}-${i}`,
        filter_status: "accepted",
      })
      .select("id, title")
      .single();
    if (iErr) throw iErr;
    await db
      .from("story_sources")
      .insert({ story_id: story.id, raw_item_id: item.id, source_id: src.id });
    links.push({ title: item.title, url, source: src.name });
  }
  return {
    story,
    links,
    cleanup: async () => {
      await db.from("stories").delete().eq("id", story.id);
      await db
        .from("sources")
        .delete()
        .in(
          "id",
          sources.map((s) => s.id),
        );
    },
  };
}

/** Writes what the studio-generate job writes on success (see lib/studio/generate.ts finalizeBrief). */
export async function completeBrief(
  briefId: string,
  links: { title: string; url: string; source: string }[],
) {
  const db = admin();
  const output = {
    hooks: Array.from({ length: 10 }, (_, i) => `Kanca ${i + 1}`),
    titles: ["Başlık A", "Başlık B", "Başlık C"],
    x_thread: ["1/ İlk tweet", "2/ İkinci tweet", "3/ Üçüncü tweet"],
    linkedin_post: "LinkedIn gönderisi.",
    shorts_hooks: ["Kısa 1", "Kısa 2", "Kısa 3"],
    shorts_script: {
      hook: "Açılış",
      beats: ["Bir", "İki"],
      cta: "Takip et",
      duration_sec: 40,
    },
    newsletter_section: "Bülten paragrafı.",
    blog_draft: "# Blog\n\nMetin.",
    sources: links,
    ai_disclosure:
      "Bu taslak SignalCraft'ta yapay zekâ yardımıyla hazırlandı. Yayınlamadan önce kaynakları kontrol edin.",
  };
  const { error } = await db
    .from("briefs")
    .update({ output, status: "ready", model: "e2e:simulated" })
    .eq("id", briefId);
  if (error) throw error;
  await db.from("brief_versions").insert({ brief_id: briefId, output });
}
