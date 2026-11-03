import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, Output, type LanguageModel } from "ai";
import type { z } from "zod";
import { capture } from "@/lib/analytics/server";
import { limitsFor } from "@/lib/billing/limits";
import { serverEnv } from "@/lib/env";
import { assertBudget, recordUsage } from "@/lib/llm/budget";
import type { Database, Json } from "@/lib/supabase/types";
import {
  buildBriefPrompt,
  LONG_PACK_TASK,
  SHORT_PACK_TASK,
  type BriefControls,
} from "./prompts";
import { aiDisclosure, BriefOutput, LongPack, ShortPack } from "./schema";

type Db = SupabaseClient<Database>;
const LLM_TIMEOUT_MS = 60_000;
const STUDIO_JOB = "studio";

export type BriefEvent = {
  name: "studio/brief.requested";
  data: { briefId: string };
};
type Send = (event: BriefEvent) => Promise<unknown>;

function check<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

/** Counts one brief against the plan's daily limit (service role only, plan §1 #7). */
async function takeBriefUnit(admin: Db, userId: string, plan: string | null) {
  const limit = limitsFor(plan).briefsPerDay;
  return check(
    await admin.rpc("increment_usage", {
      p_user: userId,
      p_kind: "brief",
      p_limit: limit as number,
    }),
  );
}

const releaseBriefUnit = (admin: Db, userId: string) =>
  admin.rpc("release_usage", { p_user: userId, p_kind: "brief" });

async function enqueue(admin: Db, userId: string, briefId: string, send: Send) {
  try {
    await send({ name: "studio/brief.requested", data: { briefId } });
  } catch (error) {
    // Nothing will generate it: fail the brief and give the unit back.
    await admin
      .from("briefs")
      .update({ status: "failed", error: "could not enqueue generation" })
      .eq("id", briefId);
    await releaseBriefUnit(admin, userId);
    throw error;
  }
}

/**
 * POST /api/studio/generate (plan §6.3 step 1): checks the story is published and the daily
 * limit, inserts a queued brief with the service role (clients cannot insert briefs) and
 * enqueues generation.
 */
export async function requestBrief({
  userDb,
  admin,
  userId,
  plan,
  storyId,
  controls,
  send,
}: {
  userDb: Db;
  admin: Db;
  userId: string;
  plan: string | null;
  storyId: string;
  controls: BriefControls;
  send: Send;
}): Promise<
  | { status: "queued"; briefId: string }
  | { status: "limit" }
  | { status: "not_found" }
> {
  // RLS: only published stories are visible to clients.
  const { data: story } = await userDb
    .from("stories")
    .select("id")
    .eq("id", storyId)
    .maybeSingle();
  if (!story) return { status: "not_found" };

  if (!(await takeBriefUnit(admin, userId, plan))) return { status: "limit" };

  const { data: niche } = await userDb
    .from("niches")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const brief = check(
    await admin
      .from("briefs")
      .insert({
        user_id: userId,
        story_id: storyId,
        niche_id: niche?.id ?? null,
        platform: controls.platform,
        format: controls.format,
        tone: controls.tone,
        audience: controls.audience ?? null,
        length: controls.length ?? null,
        user_take: controls.user_take ?? null,
        status: "queued",
      })
      .select("id")
      .single(),
  );
  await enqueue(admin, userId, brief.id, send);
  return { status: "queued", briefId: brief.id };
}

/** "Yeniden üret": new controls, a new generation and version; counts as a brief. */
export async function requestRegenerate({
  userDb,
  admin,
  userId,
  plan,
  briefId,
  controls,
  send,
}: {
  userDb: Db;
  admin: Db;
  userId: string;
  plan: string | null;
  briefId: string;
  controls: BriefControls;
  send: Send;
}): Promise<
  | { status: "queued"; briefId: string }
  | { status: "limit" }
  | { status: "not_found" }
> {
  const { data: own } = await userDb
    .from("briefs")
    .select("id, status")
    .eq("id", briefId)
    .maybeSingle();
  if (!own) return { status: "not_found" };
  if (!(await takeBriefUnit(admin, userId, plan))) return { status: "limit" };

  check(
    await admin
      .from("briefs")
      .update({
        platform: controls.platform,
        format: controls.format,
        tone: controls.tone,
        audience: controls.audience ?? null,
        length: controls.length ?? null,
        user_take: controls.user_take ?? null,
        status: "queued",
        error: null,
      })
      .eq("id", briefId),
  );
  await enqueue(admin, userId, briefId, send);
  return { status: "queued", briefId };
}

type Pack<S extends z.ZodType> = {
  output: z.infer<S>;
  tokensIn: number;
  tokensOut: number;
};

export async function runPack<S extends z.ZodType>(
  deps: {
    db: Db;
    llm: { model: LanguageModel; id: string };
    /** Defaults to LLM_DAILY_BUDGET_USD. */
    budgetUsd?: number;
  },
  schema: S,
  system: string,
  prompt: string,
): Promise<Pack<S>> {
  // Guests can open unlimited accounts, so per-user limits are not a spend cap: stop at
  // the global daily budget like the story pipeline does.
  await assertBudget(
    deps.db,
    deps.budgetUsd ?? serverEnv().LLM_DAILY_BUDGET_USD,
  );
  const { output, usage } = await generateText({
    model: deps.llm.model,
    output: Output.object({ schema }),
    system,
    prompt,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  await recordUsage(deps.db, {
    job: STUDIO_JOB,
    model: deps.llm.id,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return {
    output: output as z.infer<S>,
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
  };
}

/** Everything a generation needs, loaded with the service role. */
export async function loadBriefContext(db: Db, briefId: string) {
  const brief = check(
    await db.from("briefs").select("*").eq("id", briefId).single(),
  );
  const [story, sourceRows, niche] = await Promise.all([
    db
      .from("stories")
      .select("title, summary, why_it_matters")
      .eq("id", brief.story_id)
      .single()
      .then(check),
    db
      .from("story_sources")
      .select("raw_items(title, url), sources(name)")
      .eq("story_id", brief.story_id)
      .order("raw_item_id")
      .then(check),
    brief.niche_id
      ? db
          .from("niches")
          .select("language, voice_samples, keywords")
          .eq("id", brief.niche_id)
          .maybeSingle()
          .then(check)
      : Promise.resolve(null),
  ]);
  // Links come from story_sources, never from the model (plan §6.2).
  const sources = sourceRows.flatMap((r) =>
    r.raw_items && r.sources
      ? [
          {
            title: r.raw_items.title,
            url: r.raw_items.url,
            source: r.sources.name,
          },
        ]
      : [],
  );
  const language = (niche?.language === "en" ? "en" : "tr") as "tr" | "en";
  const { system, prompt } = buildBriefPrompt({
    story,
    sources,
    controls: brief,
    niche: {
      language,
      voice_samples: niche?.voice_samples ?? [],
      keywords: niche?.keywords ?? [],
    },
  });
  return { brief, sources, language, system, prompt };
}

/**
 * The studio-generate job body (plan §6.3 step 2): short and long packs in parallel, merged
 * with server-side sources and disclosure, stored as the brief output and a new version.
 * On failure the brief is marked failed and the usage unit is given back.
 */
export async function generateBrief(
  deps: {
    db: Db;
    llm: { model: LanguageModel; id: string };
    budgetUsd?: number;
  },
  briefId: string,
) {
  const { brief, sources, language, system, prompt } = await loadBriefContext(
    deps.db,
    briefId,
  );
  try {
    check(
      await deps.db
        .from("briefs")
        .update({ status: "generating", error: null })
        .eq("id", briefId),
    );
    const [short, long] = await Promise.all([
      runPack(deps, ShortPack, system, `${prompt}\n\n${SHORT_PACK_TASK}`),
      runPack(deps, LongPack, system, `${prompt}\n\n${LONG_PACK_TASK}`),
    ]);
    await finalizeBrief(deps.db, briefId, {
      output: BriefOutput.parse({
        ...short.output,
        ...long.output,
        sources,
        ai_disclosure: aiDisclosure(language),
      }),
      model: deps.llm.id,
      tokensIn: short.tokensIn + long.tokensIn,
      tokensOut: short.tokensOut + long.tokensOut,
    });
  } catch (error) {
    await failBrief(deps.db, brief.id, brief.user_id, error);
    throw error;
  }
}

export async function finalizeBrief(
  db: Db,
  briefId: string,
  result: {
    output: BriefOutput;
    model: string;
    tokensIn: number;
    tokensOut: number;
  },
) {
  const output = result.output as unknown as NonNullable<Json>;
  const brief = check(
    await db
      .from("briefs")
      .update({
        output,
        // A new generation replaces earlier edits; old outputs stay in brief_versions.
        edited: null,
        selected_hook: null,
        status: "ready",
        model: result.model,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        error: null,
      })
      .eq("id", briefId)
      .select("user_id")
      .single(),
  );
  check(await db.from("brief_versions").insert({ brief_id: briefId, output }));
  await capture({
    event: "brief_generated",
    distinctId: brief.user_id,
    properties: { brief_id: briefId, model: result.model },
  });
}

export async function failBrief(
  db: Db,
  briefId: string,
  userId: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  await db
    .from("briefs")
    .update({ status: "failed", error: message.slice(0, 500) })
    .eq("id", briefId);
  await releaseBriefUnit(db, userId);
}
