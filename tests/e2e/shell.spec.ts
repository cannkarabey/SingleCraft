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

  // Radar and Studio are open to everyone (guest session); settings need an account.
  test("/radar opens for visitors without an account", async ({ page }) => {
    await page.goto("/radar");
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  });

  test("/studio opens for visitors without an account", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Studio");
  });

  test("nav: links on the right, sign in and sign up, no start-free button", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "SignalCraft" });
    await expect(nav.getByRole("link", { name: "Giriş yap" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Kayıt ol" })).toHaveAttribute(
      "href",
      "/signup",
    );
    await expect(nav.getByRole("link", { name: "Ücretsiz başla" })).toHaveCount(
      0,
    );
    const logo = await nav
      .getByRole("link", { name: "SignalCraft" })
      .boundingBox();
    const discover = await nav
      .getByRole("link", { name: "Discover" })
      .boundingBox();
    expect(discover!.x).toBeGreaterThan(logo!.x + 400);
  });

  test("footer is centred and links to the legal pages", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: "Gizlilik Politikası" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Gizlilik Politikası",
    );
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(
      "1.",
    );
    await page.goto("/");
    await footer.getByRole("link", { name: "Kullanım Şartları" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Kullanım Şartları",
    );
  });

  test("marketing footer lists product links", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const name of ["Discover", "Radar", "Studio"]) {
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
