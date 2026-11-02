import { expect, test } from "@playwright/test";
import { latestMagicLink } from "./support/mail";

test.describe("auth", () => {
  test("protected pages send signed-out visitors to login", async ({
    page,
  }) => {
    await page.goto("/radar");
    await expect(page).toHaveURL(/\/login\?next=%2Fradar/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Giriş yap" }),
    ).toBeVisible();
  });

  test("magic link signs in, then sign out", async ({ page }) => {
    const email = `e2e-${Date.now()}@test.dev`;
    await page.goto("/login?next=%2Fdiscover");
    await page.getByLabel("E-posta").fill(email);
    await page.getByRole("button", { name: "Giriş linki gönder" }).click();
    await expect(
      page.getByText("Giriş linkini e-postana gönderdik."),
    ).toBeVisible();

    await page.goto(await latestMagicLink(email));
    await expect(page).toHaveURL(/\/discover$/);
    const account = page.getByRole("navigation", { name: "SignalCraft" });
    await expect(
      account.getByRole("button", { name: "Çıkış yap" }),
    ).toBeVisible();

    await account.getByRole("button", { name: "Çıkış yap" }).click();
    await expect(
      account.getByRole("link", { name: "Giriş yap" }),
    ).toBeVisible();
  });

  test("callback without a code returns to login with an error", async ({
    page,
  }) => {
    await page.goto("/auth/callback?next=%2Fradar");
    await expect(page).toHaveURL(/\/login\?error=/);
  });
});
