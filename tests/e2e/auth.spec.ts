import { expect, test } from "@playwright/test";
import { latestMagicLink } from "./support/mail";

test.describe("auth", () => {
  test("protected pages send signed-out visitors to login", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Giriş yap" }),
    ).toBeVisible();
  });

  test("sign up by magic link, then sign out and sign in again", async ({
    page,
  }) => {
    const email = `e2e-${Date.now()}@test.dev`;
    await page.goto("/signup?next=%2Fdiscover");
    await expect(
      page.getByRole("heading", { level: 1, name: "Kayıt ol" }),
    ).toBeVisible();
    await page.getByLabel("E-posta").fill(email);
    await page.getByRole("button", { name: "Kayıt linki gönder" }).click();
    await expect(
      page.getByText("Kayıt linkini e-postana gönderdik."),
    ).toBeVisible();

    await page.goto(await latestMagicLink(email));
    await expect(page).toHaveURL(/\/discover$/);
    const sidebar = page.getByRole("navigation", { name: "Uygulama" });
    await expect(
      sidebar.getByRole("button", { name: "Çıkış yap" }),
    ).toBeVisible();

    await sidebar.getByRole("button", { name: "Çıkış yap" }).click();
    // Sign-out lands on the marketing page, whose nav offers sign-in again.
    await expect(
      page
        .getByRole("navigation", { name: "SignalCraft" })
        .getByRole("link", { name: "Giriş yap" }),
    ).toBeVisible();

    // Local Supabase refuses a second link for the same user within 1 s (max_frequency).
    await page.waitForTimeout(1500);
    await page.goto("/login?next=%2Fdiscover");
    await page.getByLabel("E-posta").fill(email);
    await page.getByRole("button", { name: "Giriş linki gönder" }).click();
    await expect(
      page.getByText("Giriş linkini e-postana gönderdik."),
    ).toBeVisible();
    await page.goto(await latestMagicLink(email));
    await expect(page).toHaveURL(/\/discover$/);
    await expect(
      page
        .getByRole("navigation", { name: "Uygulama" })
        .getByRole("button", { name: "Çıkış yap" }),
    ).toBeVisible();
  });

  test("signing in with an unknown email points to sign up", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-posta").fill(`nobody-${Date.now()}@test.dev`);
    await page.getByRole("button", { name: "Giriş linki gönder" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Önce kayıt ol");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Kayıt ol" })
      .click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("guest session cannot reach member-only pages", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  });

  test("callback without a code returns to login with an error", async ({
    page,
  }) => {
    await page.goto("/auth/callback?next=%2Fradar");
    await expect(page).toHaveURL(/\/login\?error=/);
  });
});
