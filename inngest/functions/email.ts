import { inngest } from "@/inngest/client";
import { pipelineDeps } from "@/inngest/deps";
import { checkAlerts } from "@/lib/email/alerts";
import { sendDigests } from "@/lib/email/digest";
import { sendEmail } from "@/lib/email/transport";
import { recordPipelineRun } from "@/lib/pipeline/store";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Hourly: each user gets the digest when their local hour equals their digest hour.
export const sendDigest = inngest.createFunction(
  { id: "send-digest", triggers: [{ cron: "5 * * * *" }], concurrency: 1 },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const stats = await step.run("send", () => {
      const { db, now } = pipelineDeps();
      return sendDigests({
        db,
        now,
        send: (mail) => sendEmail(mail),
        appUrl: appUrl(),
      });
    });
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "send-digest",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);

// After stories are built, alert users whose niche threshold a story now crosses.
export const checkAlertsFn = inngest.createFunction(
  {
    id: "check-alerts",
    triggers: [{ event: "stories/built" }],
    concurrency: 1,
  },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const stats = await step.run("check", () => {
      const { db, now } = pipelineDeps();
      return checkAlerts({
        db,
        now,
        send: (mail) => sendEmail(mail),
        appUrl: appUrl(),
      });
    });
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "check-alerts",
        startedAt,
        stats,
      }),
    );
    return stats;
  },
);
