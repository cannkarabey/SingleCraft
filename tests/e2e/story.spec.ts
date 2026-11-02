import { expect, test } from "@playwright/test";
import { readSeed } from "./support/seed";

test.describe("story detail", () => {
  test("opens from a card and shows the brief, sources and scores", async ({
    page,
  }) => {
    const { top } = readSeed();
    await page.goto("/discover");
    await page
      .getByRole("heading", { name: top.title, exact: true })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(new RegExp(`/discover/${top.slug}$`));

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(top.title);
    await expect(
      page.getByRole("heading", { name: "Neden önemli" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${top.title} matters for builders.`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "İçerik açıları" }),
    ).toBeVisible();
    await expect(page.getByText("Hands-on review")).toBeVisible();

    const source = page.getByRole("link", {
      name: `${top.title} (original report)`,
    });
    await expect(source).toHaveAttribute(
      "href",
      `https://news.e2e.test/${top.slug}`,
    );
    await expect(source).toHaveAttribute("rel", /noopener/);

    await expect(
      page.getByRole("heading", { name: "Skor dökümü" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Skor trendi" })).toBeVisible();
  });

  test("has SEO metadata", async ({ page }) => {
    const { top } = readSeed();
    await page.goto(`/discover/${top.slug}`);
    await expect(page).toHaveTitle(new RegExp(top.title));
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      new RegExp(top.title),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /summary/,
    );
  });

  test("works by id too", async ({ page }) => {
    const { devTool } = readSeed();
    await page.goto(`/discover/${devTool.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      devTool.title,
    );
  });

  test("unknown story is a 404", async ({ page }) => {
    const response = await page.goto("/discover/no-such-story-anywhere");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Bu story bulunamadı.")).toBeVisible();
  });
});
