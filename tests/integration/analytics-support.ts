import { vi } from "vitest";

export const POSTHOG_HOST = "https://posthog.test";

export type Captured = {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
};

/**
 * Points server analytics at a fake PostHog and records what it receives; every other
 * request (Supabase) goes to the real fetch.
 */
export function fakePostHog() {
  const events: Captured[] = [];
  const realFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_it";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = POSTHOG_HOST;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith(POSTHOG_HOST)) {
        events.push(JSON.parse(String(init?.body)));
        return new Response("{}");
      }
      return realFetch(input, init);
    },
  );
  return {
    events,
    restore() {
      vi.unstubAllGlobals();
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    },
  };
}
