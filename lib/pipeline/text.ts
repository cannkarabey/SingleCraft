import { createHash } from "node:crypto";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === "#") {
        const code =
          entity[1] === "x" || entity[1] === "X"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/** Plain text from an HTML fragment: tags and script/style bodies removed, entities decoded. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  const withoutCode = stripNul(html).replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  const withoutTags = withoutCode.replace(/<[^>]*>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/** Lowercase, punctuation-free, single-spaced title for hashing and comparison. */
export function normalizeTitle(title: string): string {
  return title
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Cuts to at most `max` UTF-16 units without splitting a surrogate pair (Postgres rejects lone halves). */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const code = text.charCodeAt(max - 1);
  const splitsPair = code >= 0xd800 && code <= 0xdbff;
  return text.slice(0, splitsPair ? max - 1 : max);
}

/** Removes NUL characters, which Postgres text and jsonb cannot store. */
export function stripNul(text: string): string {
  return text.replace(/\u0000/g, "");
}

/** sha256(normalizeTitle(title) + first 500 chars of content) — exact-dedupe key. */
export function contentHash(title: string, contentText: string): string {
  return createHash("sha256")
    .update(normalizeTitle(title) + contentText.slice(0, 500))
    .digest("hex");
}
