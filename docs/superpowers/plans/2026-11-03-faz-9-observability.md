# Faz 9 — Observability, admin, beta

**Spec:** `IMPLEMENTATION_PLAN.md` §1 #10 (admin manual triggers send events), §8.2 Admin, §9 Faz 9, §10 metric → event map, §11 env, §13 risks (dedupe calibration, LLM spend).
**Done (spec):** the §10 metrics are visible as a PostHog dashboard.

## Global Constraints

- No keys exist here (PostHog, Sentry, Resend webhook). Every integration is a no-op when its env is unset; tests use fake fetch / fixtures. The PostHog dashboard is created by a script the user runs with their own key.
- Analytics never breaks a request: capture is awaited with a short timeout and errors are swallowed.
- PostHog `distinct_id` is the Supabase user id on both server and client (client `identify`).
- Events (spec §9): `niche_created`, `story_saved`, `brief_generated`, `brief_edited`, `brief_published`, `digest_opened`; plus `$pageview` from the client.
- Admin = `profiles.is_admin`. Admin pages/routes return 404 for everyone else; data is read with the service role after that check.
- Admin "manual trigger" sends an Inngest event; cron functions gain an `admin/<function-id>.run` event trigger.
- Calibration changes no weights without live data: thresholds move into one config and a labelled golden set pins dedupe behaviour.
- All UI text from `messages/{tr,en}.json`.
- Final review skipped at the user's request.

## Task 1: Server analytics
`lib/analytics/server.ts`: `capture({ event, distinctId, properties })` → POST `${NEXT_PUBLIC_POSTHOG_HOST}/i/v0/e/`; no-op without key. Emit `niche_created` (POST niches), `story_saved` (radar save), `brief_edited` (PUT brief), `brief_published` (publish), `brief_generated` (studio-generate finalize).
Verify: `npm test && npm run test:integration`.

## Task 2: Client analytics
`posthog-js` provider in the root layout: init only with a key, SPA pageviews, `identify(user.id)` when signed in, `reset()` on sign-out.
Verify: `npm run typecheck && npm run lint && npx playwright test tests/e2e/shell.spec.ts`.

## Task 3: digest_opened
`POST /api/email/webhook`: Svix signature (Resend), `email.opened` for a digest in `email_log.provider_id` → `digest_opened`. Excluded from the proxy.
Verify: `npm test && npm run test:integration`.

## Task 4: Sentry
`@sentry/nextjs` (client, server, edge via `instrumentation*.ts`, `onRequestError`), `@inngest/middleware-sentry` on the Inngest client; enabled only with a DSN.
Verify: `npm test && npm run build`.

## Task 5: Admin data + API
Migration: `admin_reject_reasons(since)`, `admin_llm_spend(days)`; cron functions get `admin/<id>.run` triggers. `lib/admin/*`: `requireAdmin`, queries (sources, runs, spend, reject reasons, recent rejected items). `PATCH /api/admin/sources/[id]` (active, trust_weight), `POST /api/admin/jobs` (`{ job }` → event).
Verify: `npx supabase test db && npm test && npm run test:integration`.

## Task 6: Admin UI
`/admin`: sources table (toggle, trust edit, last error), recent runs, 14-day LLM spend, job buttons, reject reasons + recent rejected items.
Verify: `npx playwright test tests/e2e/admin.spec.ts`.

## Task 7: Calibration
`lib/pipeline/config.ts` holds score weights, early-signal rules, cluster threshold (0.85), near-duplicate Hamming distance (3), filter lists/lengths; modules import from it. Golden set `tests/fixtures/calibration/pairs.json` (same-story / different-story title pairs) checked against the Hamming threshold.
Verify: `npm test`.

## Task 8: Feedback widget
`feedback` table (service role only), `POST /api/feedback` (signed in, 1–2000 chars, 20/day), widget in the app layout, latest feedback in `/admin`.
Verify: `npx supabase test db && npm run test:integration && npx playwright test tests/e2e/feedback.spec.ts`.

## Task 9: PostHog dashboard + done
`lib/analytics/dashboard.ts` (§10 insights) + `scripts/posthog-dashboard.ts` (idempotent by name, PostHog API with personal key). Done test: one user's flow emits every §9 event to a fake PostHog.
Verify: full suite once.
