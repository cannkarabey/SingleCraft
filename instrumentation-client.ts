import { sentryOptions } from "@/lib/observability/sentry";

// Browser error reporting. Loaded only when a DSN is set, so it adds nothing to the
// bundle the landing page's performance budget (Faz 4) is measured on.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init(sentryOptions(dsn, process.env.NODE_ENV)),
  );
}
