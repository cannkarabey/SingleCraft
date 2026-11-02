import { expect, test } from "@playwright/test";
import { readSeed } from "./support/seed";

const seed = () => readSeed();
type Page = import("@playwright/test").Page;
const cards = (page: Page) => page.locator("article");
/** The feed card whose heading is exactly this title (titles also appear in side panels). */
const card = (page: Page, title: string) =>
  cards(page).filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });

test.describe("discover (signed out)", () => {
  test("lists today's stories with signals", async ({ page }) => {
    await page.goto("/discover");
    const top = card(page, seed().top.title);
    await expect(top).toBeVisible();
    await expect(top.getByText("HN 412")).toBeVisible();
    await expect(card(page, seed().old.title)).toHaveCount(0);
  });

  test("filters by category via the URL", async ({ page }) => {
    await page.goto("/discover");
    await page
      .getByRole("navigation", { name: "Kategoriler" })
      .getByRole("link", { name: /Geliştirici Araçları/ })
      .first()
      .click();
    await expect(page).toHaveURL(/category=developer_tools/);
    await expect(card(page, seed().devTool.title)).toBeVisible();
    await expect(card(page, seed().top.title)).toHaveCount(0);
  });

  test("filters by time range", async ({ page }) => {
    await page.goto("/discover");
    await page.getByRole("link", { name: "Bu hafta" }).click();
    await expect(page).toHaveURL(/range=week/);
    await expect(card(page, seed().old.title)).toBeVisible();
  });

  test("searches stories", async ({ page }) => {
    await page.goto("/discover");
    const search = page.getByRole("searchbox", { name: "Story ara" });
    await search.fill(`wombat ${seed().tag}`);
    await search.press("Enter");
    await expect(page).toHaveURL(/q=wombat/);
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, seed().devTool.title)).toBeVisible();
  });

  test("⌘K focuses search", async ({ page }) => {
    await page.goto("/discover");
    // The shortcut listener attaches on hydration; retry until it is live.
    await expect(async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(
        page.getByRole("searchbox", { name: "Story ara" }),
      ).toBeFocused({ timeout: 500 });
    }).toPass();
  });

  test("loads more stories", async ({ page }) => {
    await page.goto("/discover");
    await expect(cards(page)).toHaveCount(20);
    await page.getByRole("button", { name: "Daha fazla" }).click();
    await expect.poll(() => cards(page).count()).toBeGreaterThan(20);
  });

  test("actions ask a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/discover");
    const top = card(page, seed().top.title);
    await top.getByRole("button", { name: "Radar'a ekle" }).click();
    await expect(
      page.getByRole("dialog", { name: "Devam etmek için giriş yap" }),
    ).toBeVisible();
  });

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/discover");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("changing a filter after loading more shows only matching stories (review I1)", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Daha fazla" }).click();
    await expect.poll(() => cards(page).count()).toBeGreaterThan(20);
    await page
      .getByRole("navigation", { name: "Kategoriler" })
      .getByRole("link", { name: /Geliştirici Araçları/ })
      .first()
      .click();
    await expect(page).toHaveURL(/category=developer_tools/);
    await expect(card(page, seed().devTool.title)).toBeVisible();
    await expect(cards(page).filter({ hasText: "Numbat filler" })).toHaveCount(
      0,
    );
  });

  test("story card headings follow the page h1 (review I4)", async ({
    page,
  }) => {
    await page.goto("/discover");
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: seed().top.title,
        exact: true,
      }),
    ).toBeVisible();
  });
});
