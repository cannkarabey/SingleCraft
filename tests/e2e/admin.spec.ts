import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { seedSource, setAdmin, userIdByEmail } from "./support/radar-seed";

test.describe("admin panel (plan §8.2)", () => {
  test("signed-out visitors are sent to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  });

  test("non-admins get a 404", async ({ page }) => {
    await signIn(page, "/settings");
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });

  test("admin sees the panel, edits a source and runs a job", async ({
    page,
  }) => {
    const source = await seedSource();
    try {
      const email = await signIn(page, "/settings");
      await setAdmin(await userIdByEmail(email));
      await page.goto("/admin");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
      for (const name of [
        "Kaynaklar",
        "Son çalıştırmalar",
        "LLM harcaması (14 gün)",
        "Reddedilen içerikler (7 gün)",
        "Manuel çalıştır",
      ]) {
        await expect(page.getByRole("heading", { name })).toBeVisible();
      }

      const row = page.getByRole("row").filter({ hasText: source.name });
      await row.getByLabel("Güven").fill("0.42");
      await row.getByRole("button", { name: "Kaydet" }).click();
      await expect(row.getByRole("status")).toHaveText("Kaydedildi");
      const patched = page.waitForResponse(
        (r) =>
          r.url().includes(`/api/admin/sources/${source.id}`) &&
          r.request().method() === "PATCH",
      );
      await row.getByRole("checkbox", { name: "Aktif" }).uncheck();
      expect((await patched).ok()).toBe(true);
      await expect(row.getByRole("status")).toHaveText("Kaydedildi");

      await page.reload();
      const reloaded = page.getByRole("row").filter({ hasText: source.name });
      await expect(reloaded.getByLabel("Güven")).toHaveValue("0.42");
      await expect(
        reloaded.getByRole("checkbox", { name: "Aktif" }),
      ).not.toBeChecked();

      const jobs = page.getByRole("region", { name: "Manuel çalıştır" });
      await jobs.getByRole("button", { name: "score-stories" }).click();
      await expect(jobs.getByRole("status")).toHaveText(
        "score-stories kuyruğa alındı",
      );
    } finally {
      await source.remove();
    }
  });
});
