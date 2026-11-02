// Server-side product analytics (IMPLEMENTATION_PLAN §10). PostHog's capture endpoint is
// called directly: one POST per event, no SDK, no background flush to lose on serverless.

export type AnalyticsEvent =
  | "signed_up"
  | "niche_created"
  | "story_saved"
  | "brief_generated"
  | "brief_edited"
  | "brief_published"
  | "digest_sent"
  | "digest_opened";

type Config = { key: string | undefined; host: string };
const DEFAULT_HOST = "https://us.i.posthog.com";
const TIMEOUT_MS = 2_000;

export function analyticsConfig(): Config {
  return {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY || undefined,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST,
  };
}

/**
 * Records one event for a user (distinct_id = Supabase user id, same as the client's
 * `identify`). A no-op without a key; never throws, so analytics cannot fail a request.
 */
export async function capture(
  input: {
    event: AnalyticsEvent;
    distinctId: string;
    properties?: Record<string, unknown>;
  },
  deps: { config?: Config; fetch?: typeof fetch } = {},
): Promise<void> {
  const config = deps.config ?? analyticsConfig();
  if (!config.key) return;
  try {
    await (deps.fetch ?? fetch)(`${config.host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: config.key,
        event: input.event,
        distinct_id: input.distinctId,
        properties: { ...input.properties, $lib: "signalcraft-server" },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Analytics is best effort.
  }
}
