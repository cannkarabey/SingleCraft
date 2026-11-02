import { NextResponse } from "next/server";

/** Public JSON: CDN-cacheable for a minute, served stale while revalidating for five. */
export function publicJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
      ...init.headers,
    },
  });
}

export function badRequest(errors: string[]) {
  return NextResponse.json(
    { error: "invalid_request", details: errors },
    { status: 400 },
  );
}
