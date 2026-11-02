// Shared Sentry options for client, server, edge and Inngest (plan §9 Faz 9).
// Without a DSN Sentry stays off; no user PII (emails, IPs) is sent.

const TRACES_SAMPLE_RATE = 0.1;

export function sentryOptions(dsn: string | undefined, environment: string) {
  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
  };
}
