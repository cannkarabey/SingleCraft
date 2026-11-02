import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { setPlan, userIdByEmail } from "./support/radar-seed";

test.describe("pricing and billing", () => {
  test("pricing shows plan limits from one source; signed-out upgrade goes to login", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fiyatlandırma",
    );
    const free = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Free" }) });
    const creator = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Creator" }) });
    await expect(free.getByText("Günde 3 Radar sinyali")).toBeVisible();
    await expect(free.getByText("Günde 2 Studio brief'i")).toBeVisible();
    await expect(free.getByText("1 niş")).toBeVisible();
    await expect(creator.getByText("Sınırsız Radar sinyali")).toBeVisible();
    await expect(creator.getByText("3 niş")).toBeVisible();
    await expect(creator.getByText("Günlük özet e-postası")).toBeVisible();
    await expect(page.getByText("Yakında")).toBeVisible();

    await creator.getByRole("link", { name: "Creator'a geç" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  });

  test("free user: settings shows the plan; checkout without configured billing explains it", async ({
    page,
  }) => {
    await signIn(page, "/settings");
    const billing = page.getByRole("region", { name: "Plan ve ödeme" });
    await expect(billing.getByText("Mevcut plan: Free")).toBeVisible();
    await billing.getByRole("button", { name: "Creator'a geç" }).click();
    await expect(billing.getByRole("alert")).toHaveText(
      "Ödemeler şu an kullanılamıyor.",
    );
  });

  test("creator user sees manage subscription", async ({ page }) => {
    const email = await signIn(page, "/discover");
    await setPlan(await userIdByEmail(email), "creator");
    await page.goto("/settings");
    const billing = page.getByRole("region", { name: "Plan ve ödeme" });
    await expect(billing.getByText("Mevcut plan: Creator")).toBeVisible();
    await expect(
      billing.getByRole("button", { name: "Aboneliği yönet" }),
    ).toBeVisible();
  });

  test("landing pricing links to the pricing page", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .getByRole("region", { name: "Fiyatlandırma" })
        .getByText("Günde 3 Radar sinyali"),
    ).toBeVisible();
  });
});
