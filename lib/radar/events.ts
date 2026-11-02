import { inngest } from "@/inngest/client";

/**
 * Best-effort: a niche change queues its embedding refresh. If Inngest is unreachable the
 * niche still works (NicheFit falls back to keywords), so the request must not fail.
 */
export async function emitNicheChanged(nicheId: string) {
  try {
    await inngest.send({ name: "radar/niche.changed", data: { nicheId } });
  } catch (error) {
    console.warn(
      "radar/niche.changed not sent:",
      error instanceof Error ? error.message : error,
    );
  }
}
