import { inngest } from "@/inngest/client";

// Smoke-test function: proves the Inngest endpoint, dev server and cron wiring work.
// Replaced by real pipeline functions in Faz 2.
export const heartbeat = inngest.createFunction(
  { id: "heartbeat", triggers: [{ event: "app/heartbeat" }] },
  async ({ step }) =>
    step.run("ping", () => ({ ok: true, at: new Date().toISOString() })),
);
