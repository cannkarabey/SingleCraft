// Real page captures for the landing's module cards (public/marketing/<module>-<locale>.webp).
// Needs the app running (NEXT_PUBLIC_APP_URL=http://localhost:3100 npm run dev -- --port 3100),
// local Supabase with some published stories, and a demo user (SHOT_EMAIL) with a niche and
// at least one ready brief. Re-run after UI changes to refresh the images.
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const MAILPIT = "http://127.0.0.1:54324";
const EMAIL = process.env.SHOT_EMAIL ?? "demo-shots@test.dev";
const OUT = "public/marketing";
// The page area to the right of the sidebar, top part only.
const CLIP = { x: 242, y: 10, width: 1188, height: 640 };

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

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
      const match = (msg.HTML || msg.Text || "").match(
        /href="([^"]*\/auth\/v1\/verify[^"]*)"/,
      );
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic link for ${email}`);
}

const { data: user } = await db.auth.admin
  .listUsers({ perPage: 1000 })
  .then((r) => ({ data: r.data.users.find((u) => u.email === EMAIL) }));
if (!user) throw new Error(`no user ${EMAIL}; seed the demo user first`);
const { data: brief } = await db
  .from("briefs")
  .select("id")
  .eq("user_id", user.id)
  .eq("status", "ready")
  .limit(1)
  .single();

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const locale of ["tr", "en"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: locale === "tr" ? "tr-TR" : "en-US",
    });
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: BASE },
    ]);
    const page = await context.newPage();
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/E-posta|Email/).fill(EMAIL);
    await page
      .getByRole("button", { name: /Giriş linki gönder|Send sign-in link/ })
      .click();
    await page.getByRole("status").waitFor();
    await page.goto(await magicLink(EMAIL));
    for (const [name, path] of [
      ["discover", "/discover"],
      ["radar", "/radar"],
      ["studio", `/studio/${brief.id}`],
    ]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.addStyleTag({
        content:
          ".fixed, nextjs-portal, [data-nextjs-dev-tools-button]{display:none!important}",
      });
      const png = await page.screenshot({ clip: CLIP });
      const file = `${OUT}/${name}-${locale}.webp`;
      await sharp(png).resize(1200).webp({ quality: 82 }).toFile(file);
      console.log(file);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
