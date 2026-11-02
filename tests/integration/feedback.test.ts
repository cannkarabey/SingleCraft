import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminOverview } from "@/lib/admin/queries";
import { FEEDBACK_DAILY_LIMIT, submitFeedback } from "@/lib/feedback";
import { db } from "./helpers";
import { makeUser } from "./users";

let user: Awaited<ReturnType<typeof makeUser>>;
const now = new Date();

beforeAll(async () => {
  user = await makeUser();
});
afterAll(async () => {
  await user.remove();
});

describe("submitFeedback (Faz 9 beta)", () => {
  test("stores the message and page; admin overview lists it", async () => {
    expect(
      await submitFeedback(
        db,
        user.id,
        {
          message: "  Radar sıralaması harika  ",
          page: "/radar",
        },
        now,
      ),
    ).toBe("ok");
    const o = await adminOverview(db, now);
    expect(o.feedback[0]).toMatchObject({
      message: "Radar sıralaması harika",
      page: "/radar",
      user_id: user.id,
    });
  });

  test(`limits a user to ${FEEDBACK_DAILY_LIMIT} per day`, async () => {
    const rows = Array.from({ length: FEEDBACK_DAILY_LIMIT - 1 }, () => ({
      user_id: user.id,
      message: "filler",
    }));
    await db.from("feedback").insert(rows);
    expect(
      await submitFeedback(db, user.id, { message: "one more" }, now),
    ).toBe("limit");
  });
});
