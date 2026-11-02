# Faz 8 — Monetization (Lemon Squeezy)

**Spec:** `IMPLEMENTATION_PLAN.md` §1 #1 (provider decision → **Lemon Squeezy**, decided 2026-11-03), #2 hosting note, #7 limits, §4 subscriptions, §7 billing routes, §9 Faz 8; PDF §15 pricing (Free / Creator, Pro later).
**Done (spec):** a sandbox payment makes the plan `creator` and lifts limits; after cancelling, the plan drops to `free` at the end of the period.

## Global Constraints

- Lemon Squeezy (Merchant of Record) via its REST API (`https://api.lemonsqueezy.com/v1`, JSON:API); no SDK.
- `profiles.plan` changes only from verified webhooks (HMAC-SHA256 `X-Signature` over the raw body) or the reconcile job, through one SQL function with the service role.
- Webhooks are idempotent and order-safe: a subscription event older than the stored one is ignored.
- Plan from subscription: `active`, `on_trial`, `past_due` → paid plan; `cancelled` → paid plan until `ends_at`; `expired`, `unpaid`, `paused` → `free`.
- Limits stay in `lib/billing/limits.ts`; API and UI read them from there.
- Checkout/portal routes return 503 when Lemon Squeezy is not configured.
- No real sandbox keys here: tests use signed fixture payloads and fake fetch; final review skipped at the user's request.

## Task 1: Schema
`subscriptions` + `variant_id`, `provider_updated_at`, `ends_at`, `renews_at`, unique provider id; `apply_subscription(...)` (upsert if newer, recompute `profiles.plan` from all the user's subscriptions); `expire_subscriptions(now)`.
Verify: `npx supabase test db`.

## Task 2: Lemon Squeezy client
`lib/billing/lemonsqueezy.ts`: `verifyWebhookSignature`, `parseSubscriptionEvent`, `planForVariant`, `createCheckout`, `customerPortalUrl`.
Verify: `npm test`.

## Task 3: Webhook
`POST /api/billing/webhook`: raw body, signature, parse, `apply_subscription`.
Verify: `npm run test:integration`.

## Task 4: Checkout + portal
`POST /api/billing/checkout`, `POST /api/billing/portal`; `billing-reconcile` daily Inngest job (`expire_subscriptions`).
Verify: `npm test && npm run test:integration`.

## Task 5: Pricing + billing UI
`/pricing` (Free / Creator, Pro "soon", from `PLAN_LIMITS`), billing section on `/settings` (plan, upgrade, manage), upgrade CTAs (Radar locked rows, Studio limit, landing pricing).
Verify: `npx playwright test tests/e2e/billing.spec.ts`.

## Task 6: Done criteria
Signed webhook sequence end to end: created → `creator` and unlimited briefs; cancelled → still `creator` until `ends_at`; expired / past `ends_at` → `free`. Full suite.
