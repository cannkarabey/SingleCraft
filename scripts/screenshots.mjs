// Redesign screenshots (docs/superpowers/plans/2026-11-03-ui-redesign.md).
//   node scripts/screenshots.mjs <name> [--auth] <path...>
// Full-page PNGs at 1440 and 375 px go to docs/redesign/screenshots/<name>/. Start the app
// first (`npm run dev -- --port 3100`, or set E2E_BASE_URL). `--auth` signs in as a fresh
// user through the local Mailpit magic link; paths after it need the account.
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const MAILPIT = "http://127.0.0.1:54324";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
];

const [name, ...rest] = process.argv.slice(2);
const auth = rest.includes("--auth");
const paths = rest.filter((arg) => !arg.startsWith("--"));
if (!name || paths.length === 0) {
  console.error(
    "usage: node scripts/screenshots.mjs <name> [--auth] <path...>",
  );
  process.exit(1);
}

async function magicLink(email) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages = [] } = await res.json();
    if (messages[0]) {
      const msg = await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      ).json();
      const body = msg.HTML || msg.Text || "";
      const match = body.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic link for ${email}`);
}

const slug = (path) =>
  path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
const dir = `docs/redesign/screenshots/${name}`;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, locale: "tr-TR" });
    const page = await context.newPage();
    if (auth) {
      const email =
        process.env.SHOT_EMAIL ?? `shot-${randomUUID().slice(0, 8)}@test.dev`;
      await page.goto(`${BASE}/login`);
      await page.getByLabel(/E-posta|Email/).fill(email);
      await page
        .getByRole("button", { name: /Giriş linki gönder|Send sign-in link/ })
        .click();
      await page.getByRole("status").waitFor();
      await page.goto(await magicLink(email));
    }
    for (const path of paths) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      const file = `${dir}/${slug(path)}-${viewport.width}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
