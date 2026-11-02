import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { unsubscribeUrl } from "../../lib/email/unsubscribe";
import { signIn } from "./support/auth";
import { userIdByEmail } from "./support/radar-seed";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
const profile = async (id: string) =>
  (
    await admin()
      .from("profiles")
      .select("digest_enabled, alerts_enabled, digest_hour, timezone")
      .eq("id", id)
      .single()
  ).data!;

test.describe("email settings", () => {
  test("change digest hour, timezone and alerts", async ({ page }) => {
    const email = await signIn(page, "/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByLabel("Günlük özet saati").selectOption("7");
    await page.getByLabel("Saat dilimi").selectOption("America/New_York");
    await page.getByLabel("Alarm e-postaları").uncheck();
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByRole("status")).toHaveText("Kaydedildi.");

    await page.reload();
    await expect(page.getByLabel("Günlük özet saati")).toHaveValue("7");
    await expect(page.getByLabel("Saat dilimi")).toHaveValue(
      "America/New_York",
    );
    await expect(page.getByLabel("Alarm e-postaları")).not.toBeChecked();
    expect(await profile(await userIdByEmail(email))).toMatchObject({
      digest_hour: 7,
      timezone: "America/New_York",
      alerts_enabled: false,
    });
  });

  test("one-click unsubscribe links work without signing in", async ({
    page,
    request,
    baseURL,
  }) => {
    const email = await signIn(page, "/discover");
    const id = await userIdByEmail(email);
    await page.context().clearCookies();

    await page.goto(unsubscribeUrl(baseURL!, id, "digest"));
    await expect(page).toHaveURL(/\/unsubscribed/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Abonelikten çıktın",
    );
    expect((await profile(id)).digest_enabled).toBe(false);

    // RFC 8058: mail clients POST to the same URL.
    const res = await request.post(unsubscribeUrl(baseURL!, id, "alerts"), {
      form: { "List-Unsubscribe": "One-Click" },
    });
    expect(res.status()).toBe(200);
    expect((await profile(id)).alerts_enabled).toBe(false);

    const bad = await request.get(
      `${baseURL}/api/email/unsubscribe?u=${id}&list=digest&t=forged`,
      {
        maxRedirects: 0,
      },
    );
    expect(bad.status()).toBe(400);
  });
});
