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
      "SSS",
      "Sinyali bugün yakala.",
    ]);
  });

  test("hero badge, module figures and closing CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Yeni: Radar'da kişisel açılar/ }),
    ).toHaveAttribute("href", "/discover");
    for (const figure of ["1.0 Discover", "2.0 Radar", "3.0 Studio"]) {
      await expect(page.getByText(figure, { exact: true })).toBeVisible();
    }
    const cta = page.getByRole("region", { name: "Sinyali bugün yakala." });
    await expect(
      cta.getByRole("link", { name: "Keşfetmeye başla" }),
    ).toHaveAttribute("href", "/discover");
    await expect(
      cta.getByRole("link", { name: "Hesap oluştur" }),
    ).toHaveAttribute("href", "/signup?next=%2Fonboarding");
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

  test("the app is free: no pricing page, section or link anywhere", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/Fiyatlandırma|Ücretsiz başla/)).toHaveCount(0);
    expect((await page.goto("/pricing"))?.status()).toBe(404);
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
  });

  test("embedded platform: sidebar switches Discover, Radar and Studio", async ({
    page,
  }) => {
    await page.goto("/");
    const demo = page.getByRole("region", { name: "Discover'dan canlı" });
    await expect(demo.getByRole("tab", { name: "Discover" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await demo.getByRole("tab", { name: "Radar" }).click();
    await expect(demo.getByText("Yüksek sinyal")).toBeVisible();
    await demo.getByRole("button", { name: "Senin açın" }).first().click();
    await expect(demo.getByText("60 saniyelik bir demo")).toBeVisible();

    await demo.getByRole("tab", { name: "Studio" }).click();
    await demo.getByRole("button", { name: "LinkedIn" }).click();
    await expect(demo.getByText("Agent araçları sadeleşti")).toBeVisible();
    await demo.getByRole("button", { name: "Yayınladım" }).click();
    await expect(demo.getByText("Yayınlandı")).toBeVisible();

    await demo.getByRole("tab", { name: "Discover" }).click();
    await expect(
      demo.getByRole("heading", { name: readSeed().top.title, exact: true }),
    ).toBeVisible();
  });

  test("source logos scroll in a marquee (every source is named)", async ({
    page,
  }) => {
    await page.goto("/");
    for (const name of [
      "Hacker News",
      "GitHub",
      "Product Hunt",
      "arXiv",
      "Reddit",
      "RSS",
    ]) {
      await expect(page.getByRole("img", { name, exact: true })).toBeVisible();
    }
    const moving = page.locator(".animate-marquee");
    await expect(moving).toHaveCSS("animation-name", "marquee");
    const x = async () => (await moving.boundingBox())!.x;
    const first = await x();
    await page.waitForTimeout(600);
    expect(await x()).toBeLessThan(first);
  });

  test("module cards show the real pages and link to them", async ({
    page,
  }) => {
    await page.goto("/");
    const modules = page.getByRole("region", { name: "Tek akış, üç modül" });
    for (const [name, href] of [
      ["Discover", "/discover"],
      ["Radar", "/radar"],
      ["Studio", "/studio"],
    ]) {
      const card = modules.getByRole("link", {
        name: new RegExp(`^.*${name}`),
      });
      await expect(card.first()).toHaveAttribute("href", href);
      await expect(
        modules.getByRole("img", {
          name: `${name} sayfasının ekran görüntüsü`,
        }),
      ).toBeVisible();
    }
  });

  test("how it works highlights a step when hovered", async ({ page }) => {
    await page.goto("/");
    const steps = page.getByRole("region", { name: "Nasıl çalışır" });
    const third = steps.getByRole("button", { name: /Story'lere kümele/ });
    await third.hover();
    await expect(third).toHaveAttribute("aria-current", "step");
    await expect(third).toContainText("embedding");
  });
});
