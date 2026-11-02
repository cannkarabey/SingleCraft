# Faz 3 — Clustering, scoring, story builder

**Spec:** `IMPLEMENTATION_PLAN.md` §2 (LLM rules), §5.3 (semantic dedupe), §5.5 (scoring), §5.7 (story builder), §6.1, §9 Faz 3.
**Done (spec):** three sources about the same event land in one story; ≤ 40 LLM calls/day (verified via `llm_usage`); every published story has title, summary, category.

## Global Constraints

- No LLM call inside HTTP routes; only Inngest functions (and the `ingest:once` dev script).
- Model names come from env (`LLM_STORY_MODEL`, `LLM_EMBED_MODEL` = `provider:model`); code holds no model ids.
- All LLM calls: 30 s timeout, structured output validated with Zod, usage recorded in `llm_usage`, daily budget checked first.
- Embeddings are 768-dimensional.
- Unit tests use `ai/test` mock models; integration tests run against local Supabase.
- No live LLM calls in tests.

## Architecture decisions for this phase

- Clustering is done in SQL (`cluster_item`) so match → attach → centroid update is one atomic statement; the Inngest function runs with concurrency 1.
- Duplicates from Faz 2 (`filter_status = 'duplicate'`) join their root's story via `attach_duplicates()`.
- `stories.source_count` = number of `story_sources` rows; SourceDiversity uses distinct sources/types.
- Scoring math lives in pure functions (`lib/pipeline/score.ts`); metric deltas come from one SQL function (`story_metric_window`).
- `final_score` / NicheFit are user-specific and belong to Faz 5's `radar_feed`; this phase computes `global_score` only.
- Daily story-build cap `STORY_BUILD_DAILY_LIMIT` (default 40) on top of the dollar budget.

## Task 1: Schema for clustering and scoring

- pgTAP `07_stories.test.sql` first:
  - `cluster_item(item, embedding, 0.85, since)` creates a pending story + cluster + story_sources row for a new topic and returns `(story_id, created=true)`;
  - a second item with a near-identical embedding joins the same story (`created=false`), `item_count` 2, `source_count` 2, centroid = mean of both;
  - an orthogonal embedding creates a second story;
  - re-clustering an already attached item is a no-op returning its story;
  - `attach_duplicates()` adds duplicate items whose root is in a story and bumps `source_count`; idempotent;
  - `story_metric_window(since, window_start)` returns latest and earliest-in-window values per (story, item, metric);
  - `archive_stale_stories(cutoff)` archives pending/published stories first seen before cutoff, returns count;
  - none executable by anon/authenticated.
- Migration `20261102000003_stories.sql`. Regenerate types.
- Commit `feat(db): clustering and scoring functions`.

## Task 2: Scoring functions

Produces in `lib/pipeline/score.ts`: `SCORE_WEIGHTS`, `ENGAGEMENT_CAPS`, `engagementScore`, `velocityRaw`, `percentileRanks`, `sourceDiversityScore`, `freshnessScore`, `trustScore`, `globalScore`, `isEarlySignal`.

- Tests: boundary values for each (§5.5 table): engagement log scale with caps, mean of top two ×100, unknown metrics ignored; velocity raw from deltas/caps + new sources ×0.5; percentile ranks with ties, single story = 50, empty input; diversity 1 source = 0, 6 sources/4 types = 100; freshness 100 at 0 h, 50 at 18 h; trust mean, empty = 0; global score formula incl. trust multiplier and /0.80; early signal rule (§5.6) each condition.
- Commit `feat(pipeline): scoring functions`.

## Task 3: LLM provider, pricing, budget

Produces in `lib/llm/`: `parseModelSpec("google:gemini-…")`, `getLanguageModel(task)`, `getEmbeddingModel()`, `estimateCostUsd(model, usage)`, `assertBudget(db, job)` / `recordUsage(db, …)` / `todayCallCount(db, job)`.

- Unit: spec parsing (provider/model, invalid formats, unknown provider); cost estimate from a price table, unknown model → conservative default.
- Integration: budget blocks when today's `llm_usage` cost ≥ `LLM_DAILY_BUDGET_USD`; call count counts only today's rows for the job.
- Commit `feat(llm): provider, pricing and budget`.

## Task 4: Embedding

Produces `embedTexts(texts, deps)` in `lib/pipeline/embed.ts` → `number[][]`, 768 dims, batches, records usage (`job: 'embed'`).

- Unit with `MockEmbeddingModelV4`: returns vectors in order; requests 768 dimensions; rejects wrong-size vectors; empty input → no call.
- Commit `feat(pipeline): embeddings`.

## Task 5: Clustering orchestration

Produces `clusterItems(deps) → { embedded, created, joined, duplicatesAttached }` in `lib/pipeline/stories.ts`.

- Integration (mock embedder returning controlled vectors): three accepted items from three sources about one event → one story with `source_count` 3; an unrelated item → its own story; a Faz 2 duplicate of a clustered root → attached; running twice changes nothing.
- Commit `feat(pipeline): clustering orchestration`.

## Task 6: Scoring orchestration

Produces `scoreStories(deps) → { scored }`.

- Integration: stories from the last 72 h get all sub-scores and `global_score`; a `trend_scores` snapshot per story (`global`, `velocity`, `engagement`); story with more HN points ranks higher; archived stories untouched.
- Commit `feat(pipeline): story scoring`.

## Task 7: Story builder

Produces `lib/llm/prompts/story.ts` (prompt + Zod schema) and `buildStories(deps) → { built, skipped, failed }`.

- Integration with `MockLanguageModelV4`:
  - top-N pending stories by `global_score` are built: `status = published`, title/summary/why_it_matters/category/entities/sentiment/creator_relevance/suggested_angles, `slug`, `last_built_at`, `built_source_count = source_count`, one `llm_usage` row each;
  - a published story is rebuilt only when `source_count - built_source_count ≥ 3`;
  - stops when the daily call limit or the budget is reached;
  - a model returning invalid output → story stays pending, failure counted, other stories continue;
  - prompt contains only source material from the cluster (≤ 6 items, ≤ 800 chars each).
- Commit `feat(pipeline): story builder`.

## Task 8: Inngest wiring

- `process-items` emits `items/processed`; new `cluster-items` (event, concurrency 1), `score-stories` (cron `*/30`, emits `stories/scored`), `build-stories` (event `stories/scored`, concurrency 1), `archive-stories` (daily cron). All record `pipeline_runs`.
- Unit: registered ids.
- Commit `feat(jobs): story pipeline functions`.

## Task 9: Dev script, docs, verification

- `ingest:once` runs cluster → score → build after ingestion when the LLM env is configured (skips with a message otherwise).
- README + `.env.example` (`STORY_BUILD_DAILY_LIMIT`).
- Live check with real keys if available; otherwise the spec criteria are covered by integration tests and the live run is reported as pending keys.
- Commit `chore: story pipeline in ingest-once, docs`.
