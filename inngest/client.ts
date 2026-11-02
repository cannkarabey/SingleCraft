import { sentryMiddleware } from "@inngest/middleware-sentry";
import { Inngest } from "inngest";

// Function failures go to Sentry (initialised in instrumentation.ts; a no-op without a
// DSN). Only the final attempt is reported, so retried transient errors stay quiet.
export const inngest = new Inngest({
  id: "signalcraft",
  middleware: [sentryMiddleware()],
});
