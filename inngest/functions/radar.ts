import { inngest } from "@/inngest/client";
import { embedDeps } from "@/inngest/deps";
import { getLanguageModel } from "@/lib/llm/provider";
import { embedNiche, generateAngle } from "@/lib/radar/angle";
import { createAdminClient } from "@/lib/supabase/admin";

// Niche embedding for NicheFit (plan §5.5). Without an embedding model NicheFit uses
// keywords only, so failures here are not user-facing.
export const nicheEmbed = inngest.createFunction(
  {
    id: "niche-embed",
    triggers: [{ event: "radar/niche.changed" }],
    concurrency: 2,
  },
  async ({ event, step }) => {
    const { nicheId } = event.data as { nicheId: string };
    await step.run("embed", () => embedNiche(embedDeps(), nicheId));
    return { nicheId };
  },
);

// Personal angle (plan §7 POST /api/radar/[storyId]/angle). No retries: a failed run
// already gave the usage unit back, and the user can ask again.
export const radarAngle = inngest.createFunction(
  {
    id: "radar-angle",
    triggers: [{ event: "radar/angle.requested" }],
    retries: 0,
    concurrency: { limit: 1, key: "event.data.userId" },
  },
  async ({ event, step }) => {
    const data = event.data as {
      userId: string;
      nicheId: string;
      storyId: string;
    };
    const angle = await step.run("generate", () =>
      generateAngle(
        { db: createAdminClient(), llm: getLanguageModel("angle") },
        data,
      ),
    );
    return { angle };
  },
);
