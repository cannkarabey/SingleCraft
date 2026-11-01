# SignalCraft

Daily signal radar for tech content creators: **Discover → Radar → Studio**.
Product brief: `SignalCraft.pdf`. Build plan and binding decisions: `IMPLEMENTATION_PLAN.md`.

## Requirements

- Node 24, npm
- Docker (for local Supabase)

## Local development

```bash
npm install
npx playwright install chromium   # once, for e2e tests

npm run db:start                  # local Supabase (first run pulls Docker images)
npx supabase status -o env        # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY into .env.local
cp .env.example .env.local        # then fill the three Supabase values

npm run dev                       # http://localhost:3000
npm run inngest                   # Inngest dev server → http://localhost:8288
```

## Database

```bash
npm run db:reset    # re-apply supabase/migrations + supabase/seed.sql
npm run db:test     # pgTAP tests in supabase/tests/database
npm run db:types    # regenerate lib/supabase/types.ts after a schema change
```

Schema changes go in a **new** migration file; existing migrations are never edited.

## Checks

```bash
npm run lint
npm run typecheck
npm test            # unit (Vitest)
npm run test:e2e    # Playwright (needs .env.local)
```

## i18n

UI is Turkish and English. The locale comes from the `NEXT_LOCALE` cookie, then
`Accept-Language`, defaulting to Turkish; URLs carry no locale segment. All UI text
lives in `messages/tr.json` and `messages/en.json`, which must keep identical keys
(enforced by a unit test).
