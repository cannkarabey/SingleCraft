import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { LIMITS } from "../../lib/limits";
import { nicheFor } from "./support/radar-seed";
import { seedStudioStory } from "./support/studio-seed";

// The daily brief limit (LIMITS.briefsPerDay) shows its message on the next brief.
test("the brief after the daily limit shows the limit message", async ({
  page,
}) => {
  const seed = await seedStudioStory();
  try {
    const email = await signIn(page, "/discover");
    await nicheFor(email, { name: "Agents", keywords: ["agents"] });

    for (let i = 0; i < LIMITS.briefsPerDay!; i++) {
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
    ).toHaveCount(LIMITS.briefsPerDay!);
  } finally {
    await seed.cleanup();
  }
});
