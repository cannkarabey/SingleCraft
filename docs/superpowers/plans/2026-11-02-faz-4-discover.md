# Faz 4 — Discover + landing

**Spec:** `IMPLEMENTATION_PLAN.md` §7 (public routes), §8.1 (tokens), §8.2 (Landing, Discover, Story detail), §9 Faz 4; `SignalCraft.pdf` §11–12. §1 decisions binding (#15 TR+EN, #16 Discover public, #17 FTS, #18 never show `content_text`).
**Done (spec):** a signed-out visitor can filter and search Discover; Lighthouse performance ≥ 90; no horizontal scroll at 375 px.

## Global Constraints

- Public data is read with the anon Supabase client under RLS; anything RLS hides (`raw_items`, `item_metrics`) reaches the public only through narrow `security definer` SQL functions that check `status = 'published'`.
- `content_text` is never sent to the browser; only our summary + source title/link.
- All UI text from `messages/{tr,en}.json` (parity test). Story text itself is English (LLM output).
- Design per §8.1: tokens, Geist, mono only for metadata, accent only for CTA/high signal, motion 120–180 ms.
- Pages render dynamically (cookie locale, Faz 0 ruling); public JSON routes send `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- Route inputs validated with Zod; invalid input → 400.
- Actions that need an account (Radar'a ekle / Studio'da üret) open a sign-in prompt; auth itself is Faz 5.

## Task 1: Public SQL accessors

- pgTAP `09_discover.test.sql` first: `discover_story_sources(story)` returns title/url/source name/type/published_at for a published story, nothing for pending, never `content_text`; `discover_story_signals(ids[])` returns per story the max HN points, HN comments, Reddit upvotes, GitHub stars, PH votes, only for published ids; both executable by anon.
- Migration `20261102000005_discover.sql`; regenerate types.
- Verify: `npx supabase test db`.

## Task 2: Discover query layer

Produces `lib/discover/queries.ts`: `listStories({ category?, range, q?, cursor?, limit })` → `{ items, nextCursor }` (published only, `global_score desc, id desc` keyset cursor, range today = since 00:00 UTC / 24h / 7d, `q` → websearch FTS), `getStory(idOrSlug)`, `categoryCounts(since)`, `trendingPanel`, `newToolsPanel`, `githubPanel`, `storyTrend(id)`; cursor encode/decode.

- Integration tests against local DB with own published fixture stories.
- Verify: `npm run test:integration`.

## Task 3: Presentation helpers

Produces `lib/discover/format.ts`: `signalLevel(story)` (high: global ≥ 75, early: `is_early_signal`, low: trust < 0.4, else normal; low wins over others), `compactNumber`, `relativeTime(date, now, locale)`, category label keys.

- Unit tests. Verify: `npm test`.

## Task 4: Public API routes

`GET /api/discover`, `GET /api/discover/[storyId]`, `GET /api/categories`, `GET /api/trending?panel=trending|new_tools|github`.

- Integration tests calling the route handlers: validation 400s, shapes, cursor round trip, cache header, unknown story 404, no `content_text` in any payload.
- Verify: `npm run test:integration`.

## Task 5: Story UI components

`components/story/`: `SignalBar`, `PlatformSignals`, `ScoreBadge`, `StoryCard` (category label, title, summary, mono meta line, platform chips, expandable "why it matters", actions with sign-in prompt), `SourceList`, `ScoreBreakdown`, `Sparkline` (inline SVG).

- Verify: `npm run typecheck && npm run lint`.

## Task 6: Discover page

`/discover`: left category list with counts + panels (Trending, New AI tools, GitHub rising); top bar with range filter + search (⌘K focuses); story list with cursor "load more"/infinite scroll; filters in the URL; mobile: horizontal category chips, panels below; empty state.

- E2E (Playwright global setup seeds published stories, teardown removes them): category filter, range filter, search, load more, signed-out action → sign-in prompt, 375 px no horizontal scroll.
- Verify: `npx playwright test tests/e2e/discover.spec.ts`.

## Task 7: Story detail

`/discover/[storyId]` (id or slug): summary, why it matters, entities, suggested angles, sources (type, name, time, link), score breakdown, sparkline; `generateMetadata` (title, description, Open Graph); 404 for unknown/non-published.

- E2E: detail opens from a card, shows sources, 404 path. Verify: `npx playwright test tests/e2e/story.spec.ts`.

## Task 8: Landing page

`/`: Hero (two CTAs) → live `DiscoverPreview` (top stories, real data) → bento (Discover/Radar/Studio) → problem → 5-step pipeline → example output (X thread / LinkedIn / Shorts tabs, illustrative) → pricing (Free / Creator, Pro "soon") → FAQ.

- E2E: sections present, preview shows a seeded story, TR/EN, 375 px. Verify: `npx playwright test tests/e2e/landing.spec.ts tests/e2e/shell.spec.ts`.

## Task 9: Performance check

- Production build + Lighthouse (mobile preset) on `/` and `/discover`. Expected: performance ≥ 90. Fix what it flags.
- Verify: full suite once (`lint`, unit, typecheck, integration, pgTAP, e2e, build).
