import { expect, test } from "@playwright/test";
import { readSeed } from "./support/seed";

test.describe("landing", () => {
  test("has every section in order", async ({ page }) => {
    await page.goto("/");
    const headings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(headings).toEqual([
      "Discover'dan canlı",
      "Tek akış, üç modül",
      "Fikir bulmak, trendi doğrulamak ve her platforma uyarlamak ayrı ayrı zaman alıyor.",
      "Nasıl çalışır",
      "Örnek çıktı",
      "Fiyatlandırma",
      "SSS",
    ]);
  });

  test("live preview shows real Discover stories", async ({ page }) => {
    await page.goto("/");
    const preview = page.getByRole("region", { name: "Discover'dan canlı" });
    await expect(
      preview.getByRole("heading", { name: readSeed().top.title, exact: true }),
    ).toBeVisible();
    await preview.getByRole("link", { name: "Discover'ı aç" }).click();
    await expect(page).toHaveURL(/\/discover$/);
  });

  test("example output tabs switch content", async ({ page }) => {
    await page.goto("/");
    const example = page.getByRole("region", { name: "Örnek çıktı" });
    await example.getByRole("tab", { name: "LinkedIn" }).click();
    await expect(example.getByRole("tabpanel")).toContainText(
      "Agent araçları sadeleşti",
    );
    await expect(
      example.getByRole("tab", { name: "LinkedIn" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("pricing shows Free and Creator, Pro coming soon", async ({ page }) => {
    await page.goto("/");
    const pricing = page.getByRole("region", { name: "Fiyatlandırma" });
    await expect(pricing.getByRole("heading", { name: "Free" })).toBeVisible();
    await expect(
      pricing.getByRole("heading", { name: "Creator" }),
    ).toBeVisible();
    await expect(pricing.getByText("Yakında")).toBeVisible();
  });

  test("FAQ answers expand", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Makaleleri yeniden yayınlıyor musunuz?").click();
    await expect(page.getByText("Hayır. Kendi kısa özetimizi")).toBeVisible();
  });

  test("English", async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: baseURL! },
    ]);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Live from Discover" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  });
});
