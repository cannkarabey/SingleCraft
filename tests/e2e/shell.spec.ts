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

  for (const [path, heading] of [
    ["/discover", "Bugün · AI ve geliştirici sinyalleri"],
    ["/radar", "Radar"],
    ["/studio", "Studio"],
  ] as const) {
    test(`${path} renders its page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  }

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
