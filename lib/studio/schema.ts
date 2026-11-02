import { z } from "zod";

// Studio output (IMPLEMENTATION_PLAN §6.2), generated in two parallel packs (§1 #12).

const line = z.string().trim().min(1);

export const ShortPack = z.object({
  hooks: z.array(line.max(200)).length(10),
  titles: z.array(line.max(140)).length(3),
  x_thread: z.array(line.max(280)).min(2).max(15),
  linkedin_post: line.max(3000),
  shorts_hooks: z.array(line.max(200)).min(3).max(5),
  shorts_script: z.object({
    hook: line.max(300),
    beats: z.array(line.max(400)).min(2).max(8),
    cta: line.max(200),
    duration_sec: z.number().int().min(15).max(90),
  }),
});

export const LongPack = z.object({
  newsletter_section: line.max(4000),
  blog_draft: line.max(12000),
});

export const BriefSource = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
});

/** Stored in briefs.output / brief_versions.output; sources and disclosure are server-added. */
export const BriefOutput = ShortPack.extend(LongPack.shape).extend({
  sources: z.array(BriefSource),
  ai_disclosure: z.string(),
});

export type ShortPack = z.infer<typeof ShortPack>;
export type LongPack = z.infer<typeof LongPack>;
export type BriefOutput = z.infer<typeof BriefOutput>;

/** Fixed per-language AI-use disclosure (PDF §3.3); never model-generated. */
export function aiDisclosure(language: "tr" | "en"): string {
  return language === "tr"
    ? "Bu taslak SignalCraft'ta yapay zekâ yardımıyla hazırlandı. Yayınlamadan önce kaynakları kontrol edin."
    : "This draft was prepared with AI assistance in SignalCraft. Check the sources before publishing.";
}

const URL_PATTERN = /https?:\/\/\S+/g;
const X_LINK_LENGTH = 23;

/** Approximate X character count: code points, with every link counted as 23. */
export function tweetLength(text: string): number {
  const links = text.match(URL_PATTERN) ?? [];
  return (
    Array.from(text.replace(URL_PATTERN, "")).length +
    links.length * X_LINK_LENGTH
  );
}
