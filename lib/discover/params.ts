import { z } from "zod";
import { CATEGORIES, RANGES } from "./queries";

/** Discover filters from a URL query string (API routes and the /discover page). */
export const DiscoverQuery = z.object({
  range: z.enum(RANGES as [string, ...string[]]).default("today"),
  category: z.enum(CATEGORIES as [string, ...string[]]).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type DiscoverFilters = {
  range: (typeof RANGES)[number];
  category?: (typeof CATEGORIES)[number];
  q?: string;
  cursor?: string;
  limit: number;
};

export function parseDiscoverQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const entries =
    params instanceof URLSearchParams
      ? Object.fromEntries(params.entries())
      : Object.fromEntries(
          Object.entries(params).map(([k, v]) => [
            k,
            Array.isArray(v) ? v[0] : v,
          ]),
        );
  // Empty strings from cleared form fields mean "not set".
  const cleaned = Object.fromEntries(
    Object.entries(entries).filter(([, v]) => v !== "" && v != null),
  );
  const result = DiscoverQuery.safeParse(cleaned);
  return result.success
    ? { ok: true as const, filters: result.data as DiscoverFilters }
    : {
        ok: false as const,
        error: result.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      };
}
