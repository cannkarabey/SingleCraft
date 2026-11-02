import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { adminOverview } from "@/lib/admin/queries";
import { cleanup, db, makeItem, makeSource } from "./helpers";
import { makeUser } from "./users";

let session: SupabaseClient<Database>;
const sent: { name: string; data: unknown }[] = [];
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => session }));
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: async (e: { name: string; data: unknown }) => {
      sent.push(e);
      return { ids: ["evt"] };
    },
  },
}));

const { PATCH } = await import("@/app/api/admin/sources/[id]/route");
const { POST: runJob } = await import("@/app/api/admin/jobs/route");

const created: string[] = [];
let admin: Awaited<ReturnType<typeof makeUser>>;
let member: Awaited<ReturnType<typeof makeUser>>;
let sourceId: string;

beforeAll(async () => {
  admin = await makeUser();
  member = await makeUser();
  await db.from("profiles").update({ is_admin: true }).eq("id", admin.id);
  sourceId = await makeSource(created);
  await makeItem(sourceId, "Casino spam headline", {
    filter_status: "rejected",
    reject_reason: "spam",
  });
});

afterAll(async () => {
  await admin.remove();
  await member.remove();
  await cleanup(created);
});

const body = (b: unknown, method = "POST") =>
  new Request("http://app.test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("admin API (plan §8.2)", () => {
  test("non-admins get 404 everywhere", async () => {
    session = member.client;
    expect(
      (await PATCH(body({ active: false }, "PATCH"), ctx(sourceId))).status,
    ).toBe(404);
    expect((await runJob(body({ job: "fetch-sources" }))).status).toBe(404);
    expect(sent).toHaveLength(0);
  });

  test("admin edits a source's trust and active flag", async () => {
    session = admin.client;
    const res = await PATCH(
      body({ active: false, trust_weight: 0.45 }, "PATCH"),
      ctx(sourceId),
    );
    expect(res.status).toBe(200);
    const { data } = await db
      .from("sources")
      .select("active, trust_weight")
      .eq("id", sourceId)
      .single();
    expect(data).toEqual({ active: false, trust_weight: 0.45 });
  });

  test("source update is validated", async () => {
    session = admin.client;
    expect(
      (await PATCH(body({ trust_weight: 2 }, "PATCH"), ctx(sourceId))).status,
    ).toBe(400);
    expect((await PATCH(body({}, "PATCH"), ctx(sourceId))).status).toBe(400);
    expect(
      (await PATCH(body({ active: true }, "PATCH"), ctx("nope"))).status,
    ).toBe(404);
  });

  test("manual job trigger sends the admin event", async () => {
    session = admin.client;
    const res = await runJob(body({ job: "score-stories" }));
    expect(res.status).toBe(202);
    expect(sent.at(-1)).toMatchObject({
      name: "admin/score-stories.run",
      data: { by: admin.id },
    });
    expect((await runJob(body({ job: "drop-tables" }))).status).toBe(400);
  });

  test("overview aggregates sources, spend and reject reasons", async () => {
    const o = await adminOverview(db, new Date());
    expect(o.sources.some((s) => s.id === sourceId)).toBe(true);
    expect(
      o.rejectReasons.find((r) => r.reason === "spam")?.count,
    ).toBeGreaterThan(0);
    expect(o.rejected.some((r) => r.title === "Casino spam headline")).toBe(
      true,
    );
    expect(Array.isArray(o.spend)).toBe(true);
    expect(Array.isArray(o.runs)).toBe(true);
  });
});
