begin;
select plan(8);

create function pg_temp.axis(k int) returns extensions.vector language sql as $$
  select (array_fill(0::real, array[k - 1]) || array[1::real] || array_fill(0::real, array[768 - k]))::extensions.vector
$$;

insert into public.sources (id, name, type, url) values
  ('c0000000-0000-0000-0000-000000000001', 's', 'rss', 'https://f.test/1');
insert into public.raw_items (id, source_id, external_id, url, canonical_url, title, content_hash, filter_status, published_at) values
  (700001, 'c0000000-0000-0000-0000-000000000001', 'old', 'https://f.test/a', 'https://f.test/a', 'Old', 'h1', 'accepted', now() - interval '5 days'),
  (700002, 'c0000000-0000-0000-0000-000000000001', 'future', 'https://f.test/b', 'https://f.test/b', 'Future', 'h2', 'accepted', now() + interval '2 days');

-- Review I4: a new story's first_seen_at is the seed item's publication time (never in the future)
create temp table r as select * from public.cluster_item(700001, pg_temp.axis(1), 0.85, now() - interval '72 hours');
select ok((select first_seen_at from public.stories where id = (select story_id from r)) < now() - interval '4 days',
  'story first_seen_at comes from the seed item published_at');
create temp table r2 as select * from public.cluster_item(700002, pg_temp.axis(9), 0.85, now() - interval '72 hours');
select ok((select first_seen_at from public.stories where id = (select story_id from r2)) <= now(),
  'future-dated items do not create future stories');

-- Review I2: build failure counter exists
select has_column('stories', 'build_failures', 'stories.build_failures exists');

-- Review I6: bulk score write
select lives_ok(format($$select public.apply_story_scores('[{"id": "%s", "velocity_score": 70, "engagement_score": 10, "source_diversity_score": 7.5, "freshness_score": 90, "trust_score": 0.7, "global_score": 42, "is_early_signal": true}]'::jsonb)$$,
  (select story_id from r)), 'apply_story_scores runs');
select is((select global_score from public.stories where id = (select story_id from r)), 42::real, 'scores applied in bulk');
select is((select is_early_signal from public.stories where id = (select story_id from r)), true, 'early flag applied');

-- Review I6: trend_scores retention
insert into public.trend_scores (story_id, metric, value, calculated_at) values
  ((select story_id from r), 'global', 1, now() - interval '20 days'),
  ((select story_id from r), 'global', 2, now());
select is(public.prune_trend_scores(now() - interval '14 days'), 1, 'old trend scores pruned');
select ok(not has_function_privilege('authenticated', 'public.apply_story_scores(jsonb)', 'execute'),
  'authenticated cannot call apply_story_scores');

select * from finish();
rollback;
