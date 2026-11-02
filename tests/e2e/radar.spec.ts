import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { nicheFor, seedRadarStories, setPlan } from "./support/radar-seed";

test.describe("radar", () => {
  test("shows sections, locks rows past the free limit, saves and hides", async ({ page }) => {
    const seed = await seedRadarStories([
      { topic: "agents", title: "Alpha", velocity: 100, engagement: 90 },
      { topic: "agents", title: "Bravo", velocity: 99, engagement: 90 },
      { topic: "agents", title: "Charlie", velocity: 98, engagement: 90 },
      { topic: "agents", title: "Delta", velocity: 97, engagement: 90 },
      { topic: "agents", title: "Echo early", velocity: 10, engagement: 10, early: true },
    ]);
    try {
      const email = await signIn(page, "/discover");
      await nicheFor(email, { name: "Agents", keywords: [seed.tag, "agents"] });
      await page.goto("/radar");

      await expect(page.getByRole("heading", { level: 1, name: "Radar" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Yüksek sinyal" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Erken sinyal" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "İçerik boşlukları" })).toBeVisible();

      const alpha = page.getByRole("article").filter({ hasText: seed.stories[0].title });
      await expect(alpha).toBeVisible();
      await expect(alpha.getByText("agents creators should care.")).toBeVisible();
      await expect(alpha.getByRole("link", { name: "Brief oluştur" })).toHaveAttribute(
        "href",
        `/studio/new?story=${seed.stories[0].id}`,
      );

      // Free plan: rows after the third are locked and carry no story text.
      await expect(page.getByText("Kilitli sinyal")).toHaveCount(2);
      await expect(page.getByText(seed.stories[4].title)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Yükselt" }).first()).toBeVisible();

      await alpha.getByRole("button", { name: "Kaydet" }).click();
      await expect(alpha.getByRole("button", { name: "Kaydedildi" })).toBeVisible();

      const bravo = page.getByRole("article").filter({ hasText: seed.stories[1].title });
      await bravo.getByRole("button", { name: "Gizle" }).click();
      await expect(bravo).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("article").filter({ hasText: seed.stories[1].title })).toHaveCount(0);
    } finally {
      await seed.cleanup();
    }
  });

  test("creator plan sees every row", async ({ page }) => {
    const seed = await seedRadarStories([
      { topic: "css", title: "One", velocity: 100, engagement: 90 },
      { topic: "css", title: "Two", velocity: 99, engagement: 90 },
      { topic: "css", title: "Three", velocity: 98, engagement: 90 },
      { topic: "css", title: "Four", velocity: 97, engagement: 90 },
    ]);
    try {
      const email = await signIn(page, "/discover");
      const userId = await nicheFor(email, { name: "Web", keywords: [seed.tag, "css"] });
      await setPlan(userId, "creator");
      await page.goto("/radar");
      for (const story of seed.stories) await expect(page.getByText(story.title)).toBeVisible();
      await expect(page.getByText("Kilitli sinyal")).toHaveCount(0);
    } finally {
      await seed.cleanup();
    }
  });

  test("Discover 'Radar'a ekle' saves for signed-in users", async ({ page }) => {
    const seed = await seedRadarStories([{ topic: "agents", title: "Saveme", velocity: 100, engagement: 90 }]);
    try {
      await signIn(page, "/discover");
      await page.goto(`/discover/${seed.stories[0].id}`);
      await page.getByRole("button", { name: "Radar'a ekle" }).click();
      await expect(page.getByRole("button", { name: "Radar'a eklendi" })).toBeVisible();
    } finally {
      await seed.cleanup();
    }
  });
});
