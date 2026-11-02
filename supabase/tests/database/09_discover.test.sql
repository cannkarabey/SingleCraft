begin;
select plan(9);

insert into public.sources (id, name, type, url) values
  ('d0000000-0000-0000-0000-000000000001', 'Hacker News', 'hn', 'https://d.test/hn'),
  ('d0000000-0000-0000-0000-000000000002', 'GitHub Rising', 'github', 'https://d.test/gh');
insert into public.raw_items (id, source_id, external_id, url, canonical_url, title, content_text, content_hash, filter_status, published_at) values
  (600001, 'd0000000-0000-0000-0000-000000000001', 'h', 'https://news.test/a', 'https://news.test/a', 'HN story', 'SECRET BODY', 'x1', 'accepted', now()),
  (600002, 'd0000000-0000-0000-0000-000000000002', 'g', 'https://github.com/a/b', 'https://github.com/a/b', 'a/b', 'SECRET BODY', 'x2', 'accepted', now()),
  (600003, 'd0000000-0000-0000-0000-000000000001', 'p', 'https://news.test/p', 'https://news.test/p', 'Pending', 'SECRET', 'x3', 'accepted', now());
insert into public.stories (id, status, title) values
  ('e0000000-0000-0000-0000-000000000001', 'published', 'Published'),
  ('e0000000-0000-0000-0000-000000000002', 'pending', 'Pending');
insert into public.story_sources (story_id, raw_item_id, source_id) values
  ('e0000000-0000-0000-0000-000000000001', 600001, 'd0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', 600002, 'd0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000002', 600003, 'd0000000-0000-0000-0000-000000000001');
insert into public.item_metrics (raw_item_id, metric, value, captured_at) values
  (600001, 'points', 100, now() - interval '2 hours'),
  (600001, 'points', 412, now()),
  (600001, 'comments', 238, now()),
  (600002, 'stars', 1200, now()),
  (600003, 'points', 999, now());

set local role anon;

select is((select count(*)::int from public.discover_story_sources('e0000000-0000-0000-0000-000000000001')), 2,
  'published story exposes its sources');
select ok(exists(select 1 from public.discover_story_sources('e0000000-0000-0000-0000-000000000001')
  where title = 'HN story' and url = 'https://news.test/a' and source_name = 'Hacker News' and source_type = 'hn'),
  'source rows carry title, url, source name and type');
select is_empty($$select 1 from public.discover_story_sources('e0000000-0000-0000-0000-000000000002')$$,
  'pending story exposes nothing');
select ok(not exists(
  select 1 from information_schema.routines r
   join information_schema.parameters p on p.specific_name = r.specific_name
  where r.routine_name = 'discover_story_sources' and p.parameter_name = 'content_text'),
  'content_text is not part of the result');

select results_eq(
  $$select hn_points, hn_comments, github_stars from public.discover_story_signals(array['e0000000-0000-0000-0000-000000000001'::uuid])$$,
  $$values (412, 238, 1200)$$,
  'signals use the latest value per metric');
select is_empty($$select 1 from public.discover_story_signals(array['e0000000-0000-0000-0000-000000000002'::uuid])$$,
  'no signals for unpublished stories');

reset role;
select ok(has_function_privilege('anon', 'public.discover_story_sources(uuid)', 'execute'), 'anon may read sources');
select ok(has_function_privilege('anon', 'public.discover_story_signals(uuid[])', 'execute'), 'anon may read signals');
select is((select prosecdef from pg_proc where proname = 'discover_story_sources'), true, 'sources accessor is security definer');

select * from finish();
rollback;
