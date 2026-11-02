import { inngest } from "@/inngest/client";
import { pipelineDeps } from "@/inngest/deps";
import { recordPipelineRun } from "@/lib/pipeline/store";

// Daily safety net: users whose cancelled period ended drop to free even if the
// subscription_expired webhook was missed.
export const billingReconcile = inngest.createFunction(
  { id: "billing-reconcile", triggers: [{ cron: "15 2 * * *" }] },
  async ({ step }) => {
    const startedAt = await step.run("start", () => new Date().toISOString());
    const expired = await step.run("expire", async () => {
      const { db, now } = pipelineDeps();
      const { data, error } = await db.rpc("expire_subscriptions", {
        p_now: now.toISOString(),
      });
      if (error) throw new Error(error.message);
      return data;
    });
    await step.run("record-run", () =>
      recordPipelineRun(pipelineDeps().db, {
        fn: "billing-reconcile",
        startedAt,
        stats: { expired },
      }),
    );
    return { expired };
  },
);
