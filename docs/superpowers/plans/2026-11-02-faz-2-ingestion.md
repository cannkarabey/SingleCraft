# Faz 2 — Ingestion

**Spec:** `IMPLEMENTATION_PLAN.md` §5.1–5.4, §5.8, §9 Faz 2 (§1 decisions binding; #20 Reddit optional, #21 Inngest quota).
**Done (spec):** a local run yields hundreds of `raw_items`, no URL twice, every rejected item has `reject_reason`, HN items accumulate `item_metrics` snapshots.

## Global Constraints

- Pure functions in `lib/pipeline/` with Vitest unit tests; fetchers tested against `tests/fixtures/` (no network in unit tests).
- DB access only through the service-role admin client in `lib/pipeline/store.ts`; orchestration in `lib/pipeline/ingest.ts`; Inngest functions stay thin.
- Integration tests (`tests/integration/`, `npm run test:integration`) run against local Supabase (`.env.local`).
- No LLM, no embeddings in this phase.
- New schema changes in new migrations only.

## Architecture decisions for this phase

- Normalization (canonical URL, content text, language, content hash, SimHash) happens **before insert**, because `raw_items.canonical_url` and `content_hash` are NOT NULL. `process-items` does dedupe + filter.
- Exact/near duplicates of an **accepted** item get `filter_status = 'duplicate'` and `duplicate_of = <root id>`; Faz 3 attaches them to the root's story (SourceDiversity).
- Metrics: every fetch snapshots metrics (`item_metrics`) for every item it sees, new or existing. `refresh-metrics` additionally re-polls HN items from the last 48h that left the feeds.
- One feed parser (`fast-xml-parser`) handles RSS 2.0, Atom and RDF: covers rss, reddit, youtube, arxiv and GitHub releases sources.

## Task 1: Schema for ingestion

- Step 1: pgTAP `06_ingestion.test.sql`: `raw_items.duplicate_of` exists; `filter_status` accepts `'duplicate'`; `due_sources()` returns never-fetched and overdue active sources, not fresh or inactive ones; `find_duplicate(item_id, since, max_distance)` returns `(duplicate_of, kind)` for exact canonical-url match, exact content-hash match, near SimHash match (Hamming ≤ 3), ignores non-accepted candidates and itself; all three functions not executable by anon/authenticated.
- Step 2: `npx supabase test db`. Expected: FAIL.
- Step 3: migration `20261102000001_ingestion.sql`; `seed.sql`: HN Front Page `niche_specific: false`.
- Step 4: Expected: PASS. Regenerate types.
- Step 5: commit `feat(db): ingestion schema and dedupe functions`.

## Task 2: Canonical URL

Produces: `canonicalizeUrl(url: string): string` in `lib/pipeline/canonical-url.ts`.

- Tests: lowercases host; strips `www.`; drops fragment; removes trailing slash (not root); removes `utm_*`, `ref`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`; sorts remaining params; keeps path case; `http`→ kept as is; invalid URL throws.
- RED → GREEN → commit `feat(pipeline): canonical url`.

## Task 3: Text utilities

Produces: `stripHtml(html)`, `normalizeTitle(title)`, `contentHash(title, contentText)`, `truncate(text, max)` in `lib/pipeline/text.ts`.

- Tests: tags removed, entities decoded (`&amp;` `&#39;` `&#x27;` `&nbsp;`), whitespace collapsed, `<script>/<style>` content dropped; `normalizeTitle` lowercases, strips punctuation, collapses spaces; `contentHash` = sha256 hex of `normalizeTitle(title) + contentText.slice(0,500)`, stable and title-punctuation-insensitive.
- RED → GREEN → commit `feat(pipeline): text utilities`.

## Task 4: SimHash

Produces: `simhash(text): bigint` (signed 64-bit, fits Postgres bigint), `hammingDistance(a, b): number` in `lib/pipeline/simhash.ts`.

- Tests: identical text → distance 0; result within int64 range; empty text → 0n; near-identical headlines (one word changed in a 12-word title) closer than unrelated headlines; unrelated headlines distance > 3.
- RED → GREEN → commit `feat(pipeline): simhash`.

## Task 5: Language, categories, filter

Produces: `detectLanguage(text): 'en'|'tr'|'other'|null` (`lib/pipeline/language.ts`), `preCategory(text): StoryCategory` (`lib/pipeline/categories.ts`), `filterItem(item, source, now): { status: 'accepted' } | { status: 'rejected', reason }` (`lib/pipeline/filter.ts`).

- Rules in order (first failure wins): `language` (detected other than en/tr; null = unknown passes), `stale` (published > 7 days), `too_short` (editorial sources: title+content < 80 chars; community sources hn/reddit/github/producthunt: title < 15), `spam` (banned word list), `low_trust` (trust < 0.3), `off_niche` (source `config.niche_specific === false` and `preCategory` = `other`).
- RED → GREEN → commit `feat(pipeline): language, categories and filter`.

## Task 6: Normalize

Produces: `FetchedItem` type (`lib/pipeline/types.ts`) and `normalizeItem(item, now): NormalizedItem` (`lib/pipeline/normalize.ts`) → all `raw_items` insert columns except `source_id`.

- Tests: canonical url from `item.url`; `content_text` stripped and ≤ 4000 chars; language set; `content_hash` and `simhash` set; `published_at` null-safe; invalid URL item throws.
- RED → GREEN → commit `feat(pipeline): item normalization`.

## Task 7: Feed fetcher (RSS/Atom/RDF)

Produces: `parseFeed(xml, sourceType): FetchedItem[]` and `fetchFeed(source, http)` in `lib/pipeline/fetchers/feed.ts`; `http` helper in `lib/pipeline/fetchers/http.ts` (User-Agent, 15 s timeout, conditional GET returning `{ notModified, etag, lastModified, body }`).

- Fixtures: `rss2.xml` (blog), `atom.xml` (generic), `youtube.xml`, `arxiv.xml`, `reddit.xml`, `github-releases.xml`.
- Tests: each fixture yields items with externalId (guid/id/yt:videoId/arxiv id), url, title, description/content, author, publishedAt; HTML in content preserved for normalize; CDATA handled; single-entry feeds (object not array); `fetchFeed` sends `If-None-Match` / `If-Modified-Since` and returns no items on 304.
- RED → GREEN → commit `feat(fetchers): rss/atom/rdf feed fetcher`.

## Task 8: Hacker News fetcher

Produces: `parseHn(json)`, `fetchHn(source, http)`, `hnItemsByIds(ids, http)` in `lib/pipeline/fetchers/hn.ts`.

- Tests (fixture `hn-front-page.json`): externalId = objectID; external URL kept; Ask HN (no url) → `https://news.ycombinator.com/item?id=…`; metrics `{ points, comments }`; `metadata.hn_url`; `hnItemsByIds` builds `tags=(story_1,story_2)` query.
- RED → GREEN → commit `feat(fetchers): hacker news`.

## Task 9: GitHub fetcher

Produces: `parseGithubSearch(json)`, `fetchGithub(source, http, now, token?)` in `lib/pipeline/fetchers/github.ts`; `mode: 'releases'` delegates to the feed fetcher.

- Tests (fixture `github-search.json`): externalId = repo id; url = html_url; title = full_name; description; metrics `{ stars }`; query `created:>YYYY-MM-DD` from `window_days`; Authorization header only when token given.
- RED → GREEN → commit `feat(fetchers): github`.

## Task 10: Product Hunt fetcher

Produces: `parseProductHunt(json)`, `fetchProductHunt(source, http, now, token?)` in `lib/pipeline/fetchers/producthunt.ts`.

- Tests (fixture `producthunt.json`): externalId, url (website, fallback url), title = name, description = tagline + description, metrics `{ votes, comments }`; without token returns `[]` and does no request.
- RED → GREEN → commit `feat(fetchers): product hunt`.

## Task 11: Fetcher registry

Produces: `fetchSource(source, deps): Promise<FetchResult>` in `lib/pipeline/fetchers/index.ts`, dispatching on `source.type` (+ `config.mode` for github).

- Tests: each type routes to its fetcher (fake http); unknown type throws.
- RED → GREEN → commit `feat(fetchers): registry`.

## Task 12: Store + orchestration (integration)

Produces in `lib/pipeline/ingest.ts`: `ingestSource(sourceId, deps) → { inserted: number[], seen: number }`, `processItems(ids, deps) → { accepted, rejected, duplicate }`, `refreshHnMetrics(deps)`; DB access in `lib/pipeline/store.ts`.

- Integration tests (`tests/integration/ingest.test.ts`, own fixture source rows, cleaned up):
  - ingesting the same fixture twice inserts once and snapshots metrics twice;
  - source failure increments `consecutive_failures` and records `last_error`; 5th failure deactivates; success resets;
  - 304 updates `last_fetched_at` without items;
  - `processItems`: two sources with the same canonical URL → one accepted, one `duplicate` with `duplicate_of`; rejected items carry `reject_reason`; processing twice changes nothing.
- RED → GREEN → commit `feat(pipeline): ingestion orchestration`.

## Task 13: Inngest functions

Produces: `fetch-sources` (cron `*/15 * * * *`, one `step.run` per due source, sends `items/fetched`), `process-items` (event `items/fetched`, concurrency 1), `refresh-metrics` (cron `*/30 * * * *`); each records a `pipeline_runs` row; `heartbeat` removed.

- Unit test: registered ids `fetch-sources`, `process-items`, `refresh-metrics`; unique ids.
- RED → GREEN → commit `feat(jobs): ingestion functions`.

## Task 14: Live verification

- `scripts/ingest-once.ts` (`npm run ingest:once`): runs ingest for all due sources, then processItems, then refreshHnMetrics, using the same orchestrators. Run twice against local Supabase.
- Expected (spec "Bitti"): hundreds of `raw_items`; `select canonical_url, count(*) … having count(*) > 1` only among `duplicate` rows; every `rejected` row has `reject_reason`; HN items have ≥ 2 `item_metrics` snapshots.
- Inngest dev server registers the three functions.
- README: ingestion commands. Commit `chore: ingest-once script and docs`.
