import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("landing shows nav with module links (TR by default)", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "SignalCraft" });
    await expect(nav.getByRole("link", { name: "Discover" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Radar" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Studio" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Teknoloji içerik üreticileri için günlük sinyal radarı.",
    );
  });

  test("NEXT_LOCALE=en cookie renders English", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: baseURL! },
    ]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The daily signal radar for tech content creators.",
    );
  });

  test("language switcher changes locale", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("/discover renders for signed-out visitors", async ({ page }) => {
    const response = await page.goto("/discover");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bugün · AI ve geliştirici sinyalleri",
    );
  });

  // Since Faz 5, Radar and Studio need an account.
  for (const path of ["/radar", "/studio"]) {
    test(`${path} asks signed-out visitors to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(path)}`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Giriş yap",
      );
    });
  }

  test("marketing footer lists product links", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const name of ["Discover", "Radar", "Studio", "Fiyatlandırma"]) {
      await expect(footer.getByRole("link", { name })).toBeVisible();
    }
  });

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/", "/discover"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
