import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { nicheFor } from "./support/radar-seed";
import { completeBrief, seedStudioStory } from "./support/studio-seed";

test.describe("studio", () => {
  test("create a brief, see it arrive, edit, pick a hook, publish", async ({
    page,
  }) => {
    const seed = await seedStudioStory();
    try {
      const email = await signIn(page, "/discover");
      await nicheFor(email, { name: "Agents", keywords: ["agents"] });

      await page.goto(`/studio/new?story=${seed.story.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        seed.story.title,
      );
      await page.getByLabel("Platform").selectOption("x");
      await page.getByLabel("Format").selectOption("thread");
      await page.getByLabel("Kendi görüşün").fill("Tracing matters most");
      await page.getByRole("button", { name: "Brief üret" }).click();

      await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("status")).toContainText("hazırlanıyor");
      const briefId = page.url().split("/").pop()!;

      await completeBrief(briefId, seed.links);
      await expect(
        page.getByRole("radio", { name: "Kanca 1", exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("radio")).toHaveCount(10);

      // Sources and disclosure come from the server, matching story_sources.
      for (const link of seed.links) {
        await expect(
          page.getByRole("link", { name: link.title }),
        ).toHaveAttribute("href", link.url);
      }
      await expect(page.getByText(/yapay zekâ yardımıyla/)).toBeVisible();

      // Edit tweet 1, choose hook 3, both survive a reload.
      const tweet = page.getByLabel("Tweet 1");
      await tweet.fill("1/ Benim düzenlediğim tweet");
      await expect(
        page
          .getByText("15/280")
          .or(page.getByText(/\d+\/280/))
          .first(),
      ).toBeVisible();
      await page.getByRole("radio", { name: "Kanca 3", exact: true }).check();
      await expect(page.getByText("Kaydedildi")).toBeVisible({
        timeout: 5_000,
      });
      await page.reload();
      await expect(page.getByLabel("Tweet 1")).toHaveValue(
        "1/ Benim düzenlediğim tweet",
      );
      await expect(
        page.getByRole("radio", { name: "Kanca 3", exact: true }),
      ).toBeChecked();

      // Other formats are tabs.
      await page.getByRole("tab", { name: "LinkedIn" }).click();
      await expect(page.getByLabel("LinkedIn gönderisi")).toHaveValue(
        "LinkedIn gönderisi.",
      );

      // Yayınladım
      await page.getByLabel("Yayın linki").fill("https://x.com/me/status/1");
      await page.getByRole("button", { name: "Yayınladım" }).click();
      await expect(page.getByText("Yayınlandı")).toBeVisible();

      await page.goto("/studio?status=published");
      await expect(
        page.getByRole("link", { name: seed.story.title }),
      ).toBeVisible();
      await page.goto("/studio?status=draft");
      await expect(
        page.getByRole("link", { name: seed.story.title }),
      ).toHaveCount(0);
    } finally {
      await seed.cleanup();
    }
  });

  test("a visitor without an account can generate a brief as a guest", async ({
    page,
  }) => {
    const seed = await seedStudioStory();
    try {
      await page.goto(`/studio/new?story=${seed.story.id}`);
      await expect(page).toHaveURL(/\/studio\/new\?story=/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        seed.story.title,
      );
      await page.getByRole("button", { name: "Brief üret" }).click();
      await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("status")).toContainText("hazırlanıyor");
    } finally {
      await seed.cleanup();
    }
  });
});
