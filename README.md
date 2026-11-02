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

## Ingestion (Faz 2)

Inngest functions (`npm run dev` + `npm run inngest`):

- `fetch-sources` — every 15 min; fetches each source whose `fetch_interval_min` has elapsed,
  stores normalized items, snapshots metrics, emits `items/fetched`.
- `process-items` — on `items/fetched`; exact/near dedupe against accepted items, then the
  rule-based filter (`accepted` / `rejected` + `reject_reason` / `duplicate` + `duplicate_of`).
- `refresh-metrics` — every 30 min; re-polls HN points/comments for the last 48h.

Without Inngest, one full pass with the same code:

```bash
npm run ingest:once
```

Optional tokens in `.env.local`: `GITHUB_TOKEN` (higher rate limit), `PRODUCTHUNT_TOKEN`
(Product Hunt is skipped without it). Reddit and some publishers rate-limit anonymous
requests (HTTP 429); a source that fails 5 times in a row is deactivated.

## Stories (Faz 3)

- `cluster-items` — on `items/processed`; embeds accepted items (768-dim) and joins each to the
  nearest story cluster (cosine ≥ 0.85, last 72 h) or starts a new pending story; duplicates
  join their root's story.
- `score-stories` — every 30 min; velocity, engagement, source diversity, freshness, trust →
  `global_score`, early-signal flag, `trend_scores` snapshots.
- `build-stories` — after scoring; LLM writes title/summary/why it matters/category/angles for
  the top `STORY_BUILD_TOP_N` stories, at most `STORY_BUILD_DAILY_LIMIT` calls per UTC day and
  within `LLM_DAILY_BUDGET_USD`; built stories become `published`.
- `archive-stories` — daily; stories older than 7 days are archived.

Needs `LLM_EMBED_MODEL`, `LLM_STORY_MODEL` and the provider key (`GOOGLE_GENERATIVE_AI_API_KEY`
and/or `ANTHROPIC_API_KEY`). `npm run ingest:once` runs these steps too when they are set.

## Checks

```bash
npm run lint
npm run typecheck
npm test            # unit (Vitest)
npm run test:integration  # pipeline against local Supabase (needs .env.local)
npm run test:e2e    # Playwright (needs .env.local)
```

## i18n

UI is Turkish and English. The locale comes from the `NEXT_LOCALE` cookie, then
`Accept-Language`, defaulting to Turkish; URLs carry no locale segment. All UI text
lives in `messages/tr.json` and `messages/en.json`, which must keep identical keys
(enforced by a unit test).
