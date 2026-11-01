# Faz 0–1 — Foundation (iskelet + veritabanı)

**Spec:** `IMPLEMENTATION_PLAN.md` (§1 kararları bağlayıcı; #15 TR+EN locale routing'siz, #22 repo kökü).
**Kapsam:** IMPLEMENTATION_PLAN §9 Faz 0 ve Faz 1. Faz 2+ ayrı plan.

## Global Constraints

- Next.js App Router + TypeScript strict, Tailwind v4, shadcn/ui, Geist fontları.
- Paket yöneticisi: npm. Node 24.
- Saf fonksiyonlar unit test'li (Vitest). E2E: Playwright.
- Tasarım token'ları IMPLEMENTATION_PLAN §8.1 birebir; dark-first; mor gradyan yok.
- Metinler yalnız `messages/{tr,en}.json` içinden; bileşenlerde sabit kullanıcı metni yok.
- Supabase lokal (CLI + Docker). Migration'lar `supabase/migrations/` altında, eski dosyalar değiştirilmez.
- Gizli anahtar commit edilmez; yalnız `.env.example`.

## Task 1: Next.js iskeleti

- Step 1: `create-next-app` (TS, App Router, ESLint, Tailwind, `src/` yok, import alias `@/*`) geçici klasörde kur, repo köküne taşı.
- Step 2: `package.json`'a `typecheck` (`tsc --noEmit`) script'i ekle.
- Step 3: `npm run lint && npm run typecheck && npm run build`. Expected: üçü de hatasız.
- Step 4: commit `chore: scaffold next.js app`.

## Task 2: Test altyapısı

- Step 1: Vitest (+ `vite-tsconfig-paths`), `tests/unit/smoke.test.ts` → `expect(1+1).toBe(2)`; Playwright (chromium) `playwright.config.ts` webServer `npm run dev`; Prettier.
- Step 2: `npm test`. Expected: 1 passed.
- Step 3: commit `chore: add vitest, playwright, prettier`.

## Task 3: Locale çözümleme (TDD)

Interfaces — Produces: `resolveLocale({ cookie?: string, acceptLanguage?: string }): 'tr' | 'en'`, `LOCALES`, `DEFAULT_LOCALE = 'tr'` in `lib/i18n/config.ts`.

- Step 1: `tests/unit/i18n/resolve-locale.test.ts`: geçerli çerez kazanır; geçersiz çerez yok sayılır; `Accept-Language: en-US,en;q=0.9` → en; q değerlerine göre sıralama (`tr;q=0.5,en;q=0.8` → en); desteklenmeyen dil → tr; boş → tr.
- Step 2: `npx vitest run tests/unit/i18n`. Expected: FAIL (modül yok).
- Step 3: uygula. Step 4: Expected: PASS.
- Step 5: `tests/unit/i18n/messages.test.ts`: `tr.json` ve `en.json` düzleştirilmiş anahtar setleri eşit, boş değer yok. RED (dosyalar yok) → dosyaları oluştur → GREEN.
- Step 6: `next-intl` kur; `i18n/request.ts` çerez + header'dan `resolveLocale` ile locale seçer; `next.config.ts` plugin. Dil değiştirme: `setLocale` server action, `NEXT_LOCALE` çerezi (1 yıl, `sameSite=lax`).
- Step 7: commit `feat(i18n): tr/en without locale routing`.

## Task 4: Tasarım token'ları + shadcn

- Step 1: `app/globals.css`: §8.1 token'ları, shadcn değişkenlerinin (`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--muted-foreground`, `--ring` …) token'lara eşlenmesi, `prefers-reduced-motion`.
- Step 2: `geist` paketi → `GeistSans`, `GeistMono` `app/layout.tsx`'te; `<html lang={locale} className="dark">`.
- Step 3: `shadcn init` + `button` bileşeni.
- Step 4: `npm run build`. Expected: hatasız.
- Step 5: commit `feat(ui): signal terminal design tokens`.

## Task 5: App shell + boş sayfalar (E2E)

- Step 1: `tests/e2e/shell.spec.ts`: `/` açılır, nav'da Discover/Radar/Studio linkleri; `/discover`, `/radar`, `/studio` 200 ve başlık gösterir; `NEXT_LOCALE=en` çereziyle landing hero metni EN, çerezsiz TR; 375px genişlikte yatay scroll yok.
- Step 2: `npx playwright test`. Expected: FAIL.
- Step 3: `app/(marketing)/page.tsx` (hero placeholder), `app/(app)/layout.tsx` + `components/shell/TopNav.tsx` (logo, Discover/Radar/Studio, arama placeholder, CTA, dil değiştirici), `app/(app)/{discover,radar,studio}/page.tsx` boş durumlar.
- Step 4: Expected: PASS.
- Step 5: commit `feat(shell): top nav and empty app pages`.

## Task 6: Ortam değişkenleri doğrulaması (TDD)

Interfaces — Produces: `parseServerEnv(raw)` / `parsePublicEnv(raw)` in `lib/env.ts` (Zod).

- Step 1: `tests/unit/env.test.ts`: zorunlu public alanlar eksikse anlamlı hata; geçerli URL kontrolü; `LLM_DAILY_BUDGET_USD` sayıya çevrilir, varsayılan 1; `STORY_BUILD_TOP_N` varsayılan 30.
- Step 2: RED. Step 3: uygula. Step 4: GREEN.
- Step 5: commit `feat(env): validated env parsing`.

## Task 7: Supabase client'ları + middleware

- Step 1: `@supabase/ssr`, `@supabase/supabase-js`; `lib/supabase/{server,client,admin,middleware}.ts`; kök `middleware.ts` oturum yenileme (statik dosyalar hariç matcher).
- Step 2: `admin.ts` başında `import 'server-only'`.
- Step 3: `npm run typecheck && npm run build`. Expected: hatasız (env yoksa build kırılmamalı: client'lar istek anında oluşturulur).
- Step 4: commit `feat(supabase): ssr clients and session middleware`.

## Task 8: Inngest

- Step 1: `inngest/client.ts` (`id: 'signalcraft'`), `inngest/functions/index.ts` (boş liste + `heartbeat` fonksiyonu), `app/api/inngest/route.ts` `serve()` → GET/POST/PUT.
- Step 2: `tests/unit/inngest.test.ts`: fonksiyon listesi boş değil ve id'ler benzersiz. RED → GREEN.
- Step 3: commit `feat(jobs): inngest client and endpoint`.

## Task 9: Veritabanı şeması (Faz 1)

- Step 1: `npx supabase init`; `supabase/tests/database/*.test.sql` pgTAP testleri ÖNCE:
  - tüm tablolar var; anon `raw_items`, `item_metrics`, `story_clusters`, `llm_usage`, `pipeline_runs` okuyamaz;
  - anon yalnız `published` story'leri görür;
  - kullanıcı A, B'nin `briefs`/`niches` satırlarını göremez/yazamaz;
  - kullanıcı kendi `profiles.plan`/`is_admin` alanını güncelleyemez;
  - `auth.users` insert → `profiles` satırı oluşur;
  - `increment_usage(kind, limit)` limit'e kadar true, sonra false.
- Step 2: `npx supabase db reset && npx supabase test db`. Expected: FAIL.
- Step 3: `0001_init.sql` (§4), `0002_rls.sql`, `0003_functions.sql` (`handle_new_user` trigger, `match_story_cluster`, `increment_usage`; `radar_feed` Faz 5'e kalır).
- Step 4: Expected: tüm pgTAP testleri PASS.
- Step 5: commit `feat(db): initial schema, rls, functions`.

## Task 10: Seed + tipler

- Step 1: `supabase/seed.sql`: PDF §6 kaynakları (RSS, HN, GitHub, PH, arXiv, Reddit RSS, birkaç YouTube) trust_weight ve fetch_interval_min ile; idempotent değil, `db reset` ile çalışır.
- Step 2: pgTAP: `sources` ≥ 30 satır, her tip en az 1.
- Step 3: `npx supabase gen types typescript --local > lib/supabase/types.ts`; client'lar `Database` tipini kullanır.
- Step 4: `npx supabase db reset && npx supabase test db && npm run typecheck`. Expected: PASS.
- Step 5: `.env.example` (§11 + `NEXT_PUBLIC_DEFAULT_LOCALE` yok — sabit), `README.md` lokal çalıştırma.
- Step 6: commit `feat(db): seed sources and generated types`.
