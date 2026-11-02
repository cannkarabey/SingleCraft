import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { latestMagicLink } from "./mail";

/** Signs a fresh user in through the real magic-link flow; returns their email. */
export async function signIn(page: Page, next = "/radar", email = `e2e-${randomUUID().slice(0, 8)}@test.dev`) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/E-posta|Email/).fill(email);
  await page.getByRole("button", { name: /Giriş linki gönder|Send sign-in link/ }).click();
  await page.getByRole("status").waitFor();
  await page.goto(await latestMagicLink(email));
  return email;
}
