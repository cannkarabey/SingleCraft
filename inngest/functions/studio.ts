import { inngest } from "@/inngest/client";
import { getLanguageModel } from "@/lib/llm/provider";
import {
  failBrief,
  finalizeBrief,
  loadBriefContext,
  runPack,
} from "@/lib/studio/generate";
import { LONG_PACK_TASK, SHORT_PACK_TASK } from "@/lib/studio/prompts";
import {
  aiDisclosure,
  BriefOutput,
  LongPack,
  ShortPack,
} from "@/lib/studio/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const deps = () => ({
  db: createAdminClient(),
  llm: getLanguageModel("studio"),
});

// plan §6.3 step 2: short and long packs as parallel steps, then one finalize step.
export const studioGenerate = inngest.createFunction(
  {
    id: "studio-generate",
    triggers: [{ event: "studio/brief.requested" }],
    retries: 1,
    concurrency: { limit: 2, key: "event.data.briefId" },
    onFailure: async ({ event, error }) => {
      const { briefId } = (event.data.event.data ?? {}) as { briefId?: string };
      if (!briefId) return;
      const db = createAdminClient();
      const { data: brief } = await db
        .from("briefs")
        .select("user_id")
        .eq("id", briefId)
        .maybeSingle();
      if (brief) await failBrief(db, briefId, brief.user_id, error);
    },
  },
  async ({ event, step }) => {
    const { briefId } = event.data as { briefId: string };
    const ctx = await step.run("context", async () => {
      const c = await loadBriefContext(createAdminClient(), briefId);
      await createAdminClient()
        .from("briefs")
        .update({ status: "generating", error: null })
        .eq("id", briefId);
      return {
        sources: c.sources,
        language: c.language,
        system: c.system,
        prompt: c.prompt,
      };
    });

    const [short, long] = await Promise.all([
      step.run("short-pack", () =>
        runPack(
          deps(),
          ShortPack,
          ctx.system,
          `${ctx.prompt}\n\n${SHORT_PACK_TASK}`,
        ),
      ),
      step.run("long-pack", () =>
        runPack(
          deps(),
          LongPack,
          ctx.system,
          `${ctx.prompt}\n\n${LONG_PACK_TASK}`,
        ),
      ),
    ]);

    await step.run("finalize", () =>
      finalizeBrief(createAdminClient(), briefId, {
        output: BriefOutput.parse({
          ...(short.output as object),
          ...(long.output as object),
          sources: ctx.sources,
          ai_disclosure: aiDisclosure(ctx.language),
        }),
        model: getLanguageModel("studio").id,
        tokensIn: short.tokensIn + long.tokensIn,
        tokensOut: short.tokensOut + long.tokensOut,
      }),
    );
    return { briefId };
  },
);
