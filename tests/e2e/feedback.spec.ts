import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { setAdmin, userIdByEmail } from "./support/radar-seed";

test.describe("beta feedback widget", () => {
  test("signed-out visitors do not see it", async ({ page }) => {
    await page.goto("/discover");
    await expect(
      page.getByRole("button", { name: "Geri bildirim" }),
    ).toHaveCount(0);
  });

  test("a user sends feedback and an admin reads it", async ({ page }) => {
    const email = await signIn(page, "/settings");
    const text = `Radar çok iyi ${Date.now()}`;

    await page.getByRole("button", { name: "Geri bildirim" }).click();
    const dialog = page.getByRole("dialog", { name: "Geri bildirim gönder" });
    await dialog.getByLabel("Mesajın").fill(text);
    await dialog.getByRole("button", { name: "Gönder" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Teşekkürler, aldık.");

    await setAdmin(await userIdByEmail(email));
    await page.goto("/admin");
    const section = page.getByRole("region", { name: "Geri bildirim" });
    await expect(section.getByText(text)).toBeVisible();
    await expect(
      section.getByText("/settings", { exact: false }),
    ).toBeVisible();
  });

  test("no horizontal scroll at 375 px with the widget open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, "/settings");
    await page.getByRole("button", { name: "Geri bildirim" }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
