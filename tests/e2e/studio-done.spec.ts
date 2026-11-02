import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { nicheFor } from "./support/radar-seed";
import { seedStudioStory } from "./support/studio-seed";

// IMPLEMENTATION_PLAN §9 Faz 6: a Free user sees the limit message on the 3rd brief.
test("free plan: third brief of the day shows the limit message", async ({
  page,
}) => {
  const seed = await seedStudioStory();
  try {
    const email = await signIn(page, "/discover");
    await nicheFor(email, { name: "Agents", keywords: ["agents"] });

    for (let i = 0; i < 2; i++) {
      await page.goto(`/studio/new?story=${seed.story.id}`);
      await page.getByRole("button", { name: "Brief üret" }).click();
      await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    }

    await page.goto(`/studio/new?story=${seed.story.id}`);
    await page.getByRole("button", { name: "Brief üret" }).click();
    await expect(
      page.getByText("Günlük brief limitine ulaştın."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/studio\/new\?story=/);

    await page.goto("/studio");
    await expect(
      page.getByRole("link", { name: seed.story.title }),
    ).toHaveCount(2);
  } finally {
    await seed.cleanup();
  }
});
