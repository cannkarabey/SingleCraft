import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { checkAlerts } from "@/lib/email/alerts";
import { sendDigests } from "@/lib/email/digest";
import { sendEmail } from "@/lib/email/transport";
import { createNiche } from "@/lib/radar/niches";
import { db } from "./helpers";
import { makeUser } from "./users";

// IMPLEMENTATION_PLAN §9 Faz 7 "Bitti", through the real local mail transport (Mailpit).
const cleanups: (() => Promise<unknown>)[] = [];
afterAll(async () => {
  for (const c of cleanups.reverse()) await c();
});

async function inbox(to: string) {
  const res = await fetch(
    `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
  );
  return ((await res.json()) as { messages: { Subject: string }[] }).messages;
}

describe("Faz 7 done criteria", () => {
  test("the digest arrives at the user's hour, once; an alert arrives once per story", async () => {
    delete process.env.RESEND_API_KEY;
    const tag = `gnu${randomUUID().slice(0, 6)}`;
    const { data: story } = await db
      .from("stories")
      .insert({
        status: "published",
        title: `${tag} launch story`,
        summary: "summary",
        velocity_score: 100,
        engagement_score: 95,
        source_diversity_score: 80,
        freshness_score: 100,
        trust_score: 1,
        first_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    cleanups.push(async () => db.from("stories").delete().eq("id", story!.id));

    const u = await makeUser();
    cleanups.push(u.remove);
    const now = new Date();
    await db
      .from("profiles")
      .update({
        timezone: "Europe/Istanbul",
        digest_hour: Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Istanbul",
            hour: "2-digit",
            hourCycle: "h23",
          }).format(now),
        ),
        locale: "tr",
      })
      .eq("id", u.id);
    await createNiche({
      admin: db,
      userId: u.id,
      input: { name: "Gnu", keywords: [tag, "launch"], alert_threshold: 60 },
    });

    const deps = {
      db,
      now,
      send: (mail: Parameters<typeof sendEmail>[0]) => sendEmail(mail),
      appUrl: "http://localhost:3000",
    };

    // An hour earlier is not their hour.
    await sendDigests({ ...deps, now: new Date(now.getTime() - 3600_000) });
    expect((await inbox(u.email)).map((m) => m.Subject)).not.toContain(
      "Günlük sinyallerin",
    );

    await sendDigests(deps);
    await sendDigests(deps);
    expect(
      (await inbox(u.email)).filter((m) => m.Subject === "Günlük sinyallerin"),
    ).toHaveLength(1);

    await checkAlerts(deps);
    await checkAlerts(deps);
    expect(
      (await inbox(u.email)).filter((m) =>
        m.Subject.startsWith("Yüksek sinyal:"),
      ),
    ).toHaveLength(1);
  });
});
