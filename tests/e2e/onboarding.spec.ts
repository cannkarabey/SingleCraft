import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test.describe("onboarding", () => {
  test("a new user sets up a niche and lands on Radar", async ({ page }) => {
    await signIn(page, "/radar");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByLabel("Niş adı").fill("AI agents");
    await page.getByRole("button", { name: "+ LLM" }).click();
    const keywords = page.getByLabel("Anahtar kelimeler");
    await keywords.fill("agents");
    await keywords.press("Enter");
    await expect(page.getByRole("button", { name: "Kaldır: agents" })).toBeVisible();
    await page.getByRole("button", { name: "İleri" }).click();

    await page.getByLabel("X", { exact: true }).check();
    await page.getByRole("button", { name: "İleri" }).click();

    await page.getByLabel("Ton").selectOption("technical");
    await page.getByRole("button", { name: "İleri" }).click();

    const excluded = page.getByLabel("Bu konuları hiç gösterme");
    await excluded.fill("crypto");
    await excluded.press("Enter");
    await page.getByRole("button", { name: "Bitir" }).click();

    await expect(page).toHaveURL(/\/radar$/);

    await page.goto("/radar/settings");
    await expect(page.getByLabel("Niş adı")).toHaveValue("AI agents");
    await expect(page.getByRole("button", { name: "Kaldır: crypto" })).toBeVisible();
    await page.getByLabel("Niş adı").fill("AI agents & LLMs");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByRole("status")).toHaveText("Kaydedildi.");

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/radar$/);
  });

  test("the first step needs a name", async ({ page }) => {
    await signIn(page, "/onboarding");
    await expect(page.getByRole("button", { name: "İleri" })).toBeDisabled();
  });
});
