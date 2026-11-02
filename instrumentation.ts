import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry";

// Server and edge error reporting (Sentry). Inngest functions run inside the Node server,
// so the Inngest Sentry middleware reports through this same client.
export async function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init(
      sentryOptions(
        process.env.SENTRY_DSN,
        process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      ),
    );
  }
}

export const onRequestError = Sentry.captureRequestError;
