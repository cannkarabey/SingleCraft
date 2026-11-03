import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import {
  nicheFor,
  seedRadarStories,
  setAdmin,
  userIdByEmail,
} from "./support/radar-seed";

test.describe("app shell (sidebar)", () => {
  test("signed out: Discover, Studio and sign-in (no Radar)", async ({
    page,
  }) => {
    await page.goto("/discover");
    const nav = page.getByRole("navigation", { name: "Uygulama" });
    await expect(nav.getByRole("link", { name: "Discover" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Giriş yap" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Radar" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Studio" })).toBeVisible();
  });

  test("signed in: current module is marked, also on nested routes", async ({
    page,
  }) => {
    const seed = await seedRadarStories([{ topic: "agents", title: "Shell" }]);
    try {
      const email = await signIn(page, "/discover");
      await nicheFor(email, { name: "Agents", keywords: ["agents"] });
      await page.goto("/radar");
      const nav = page.getByRole("navigation", { name: "Uygulama" });
      await expect(nav.getByRole("link", { name: "Radar" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        nav.getByRole("link", { name: "Studio" }),
      ).not.toHaveAttribute("aria-current", "page");

      await page.goto(`/studio/new?story=${seed.stories[0].id}`);
      await expect(nav.getByRole("link", { name: "Studio" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        nav.getByRole("link", { name: "Radar" }),
      ).not.toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Ayarlar" })).toBeVisible();
    } finally {
      await seed.cleanup();
    }
  });

  test("admin link only for admins", async ({ page }) => {
    const email = await signIn(page, "/radar");
    const nav = page.getByRole("navigation", { name: "Uygulama" });
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await setAdmin(await userIdByEmail(email));
    await page.reload();
    await expect(nav.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("mobile: menu opens the sidebar, Escape closes it and returns focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/discover");
    const nav = page.getByRole("navigation", { name: "Uygulama" });
    const menu = page.getByRole("button", { name: "Menü" });
    await expect(nav).toBeHidden();
    await menu.click();
    await expect(nav).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(menu).toBeFocused();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("sidebar search opens Discover with the search box focused", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page
      .getByRole("navigation", { name: "Uygulama" })
      .getByRole("link", { name: "Ara" })
      .click();
    await expect(page).toHaveURL(/\/discover\?focus=search/);
    await expect(page.getByRole("searchbox")).toBeFocused();
  });
});
