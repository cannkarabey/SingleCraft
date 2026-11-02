begin;
select plan(22);

-- 768-dim test vectors: unit vector on axis k, and a near-copy of axis 1.
create function pg_temp.axis(k int) returns extensions.vector language sql as $$
  select (array_fill(0::real, array[k - 1]) || array[1::real] || array_fill(0::real, array[768 - k]))::extensions.vector
$$;
create function pg_temp.near_axis1() returns extensions.vector language sql as $$
  select (array[0.99::real, 0.14::real] || array_fill(0::real, array[766]))::extensions.vector
$$;

insert into public.sources (id, name, type, url, trust_weight) values
  ('b0000000-0000-0000-0000-000000000001', 's1', 'rss', 'https://s.test/1', 0.9),
  ('b0000000-0000-0000-0000-000000000002', 's2', 'hn',  'https://s.test/2', 0.7),
  ('b0000000-0000-0000-0000-000000000003', 's3', 'rss', 'https://s.test/3', 0.8);
insert into public.raw_items (id, source_id, external_id, url, canonical_url, title, content_hash, filter_status) values
  (800001, 'b0000000-0000-0000-0000-000000000001', 'a', 'https://e.test/a', 'https://e.test/a', 'A', 'ha', 'accepted'),
  (800002, 'b0000000-0000-0000-0000-000000000002', 'b', 'https://e.test/b', 'https://e.test/b', 'B', 'hb', 'accepted'),
  (800003, 'b0000000-0000-0000-0000-000000000003', 'c', 'https://e.test/c', 'https://e.test/c', 'C', 'hc', 'accepted'),
  (800004, 'b0000000-0000-0000-0000-000000000003', 'd', 'https://e.test/a?x', 'https://e.test/a', 'A dup', 'hd', 'duplicate');
update public.raw_items set duplicate_of = 800001 where id = 800004;

-- New topic → new pending story
create temp table r1 as select * from public.cluster_item(800001, pg_temp.axis(1), 0.85, now() - interval '72 hours');
select is((select created from r1), true, 'first item creates a story');
select is((select status::text from public.stories where id = (select story_id from r1)), 'pending', 'new story is pending');
select is((select source_count from public.stories where id = (select story_id from r1)), 1, 'new story has one source');
select is((select count(*)::int from public.story_sources where raw_item_id = 800001), 1, 'item linked to story');
select ok((select embedding is not null from public.raw_items where id = 800001), 'item embedding stored');

-- Near-identical item joins it
create temp table r2 as select * from public.cluster_item(800002, pg_temp.near_axis1(), 0.85, now() - interval '72 hours');
select is((select story_id from r2), (select story_id from r1), 'similar item joins the same story');
select is((select created from r2), false, 'joining does not create');
select is((select item_count from public.story_clusters where story_id = (select story_id from r1)), 2, 'cluster item_count 2');
select is((select source_count from public.stories where id = (select story_id from r1)), 2, 'story source_count 2');
select ok(abs(((select embedding from public.story_clusters where story_id = (select story_id from r1))::real[])[1] - 0.995) < 0.0001,
  'centroid is the mean of member embeddings');

-- Orthogonal item → another story
create temp table r3 as select * from public.cluster_item(800003, pg_temp.axis(3), 0.85, now() - interval '72 hours');
select isnt((select story_id from r3), (select story_id from r1), 'unrelated item gets its own story');

-- Re-clustering is a no-op
create temp table r4 as select * from public.cluster_item(800001, pg_temp.axis(5), 0.85, now() - interval '72 hours');
select is((select story_id from r4), (select story_id from r1), 're-clustering returns the existing story');
select is((select item_count from public.story_clusters where story_id = (select story_id from r1)), 2, 're-clustering changes nothing');

-- Duplicates join their root's story
select is(public.attach_duplicates(), 1, 'one duplicate attached');
select is((select story_id from public.story_sources where raw_item_id = 800004), (select story_id from r1), 'duplicate joins root story');
select is((select source_count from public.stories where id = (select story_id from r1)), 3, 'duplicate counts as a source');
select is(public.attach_duplicates(), 0, 'attach_duplicates is idempotent');

-- Metric window
insert into public.item_metrics (raw_item_id, metric, value, captured_at) values
  (800002, 'points', 10, now() - interval '8 hours'),
  (800002, 'points', 40, now() - interval '3 hours'),
  (800002, 'points', 90, now() - interval '10 minutes');
select results_eq(
  $$select metric, latest, baseline from public.story_metric_window(now() - interval '72 hours', now() - interval '6 hours') where raw_item_id = 800002$$,
  $$values ('points'::text, 90, 10)$$,
  'baseline is the last value before the window, latest is the newest');

-- Archive
update public.stories set first_seen_at = now() - interval '8 days' where id = (select story_id from r3);
select is(public.archive_stale_stories(now() - interval '7 days'), 1, 'one stale story archived');
select is((select status::text from public.stories where id = (select story_id from r3)), 'archived', 'stale story is archived');

select ok(not has_function_privilege('authenticated', 'public.cluster_item(bigint, extensions.vector, real, timestamptz)', 'execute'),
  'authenticated cannot call cluster_item');
select ok(not has_function_privilege('anon', 'public.attach_duplicates()', 'execute'), 'anon cannot call attach_duplicates');

select * from finish();
rollback;
