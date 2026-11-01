begin;
select plan(19);

-- Fixtures (as postgres, bypassing RLS)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');
insert into public.sources (id, name, type, url, etag) values
  ('10000000-0000-0000-0000-000000000001', 'Test RSS', 'rss', 'https://example.com/feed', 'W/"1"');
insert into public.raw_items (source_id, external_id, url, canonical_url, title, content_hash)
  values ('10000000-0000-0000-0000-000000000001', 'x1', 'https://e.com/1', 'https://e.com/1', 'T', 'h');
insert into public.stories (id, title, status) values
  ('20000000-0000-0000-0000-000000000001', 'Published', 'published'),
  ('20000000-0000-0000-0000-000000000002', 'Pending', 'pending');
insert into public.niches (id, user_id, name) values
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B niche');
insert into public.briefs (id, user_id, story_id, platform, format, tone) values
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b',
   '20000000-0000-0000-0000-000000000001', 'x', 'thread', 'analytical');

-- Signup trigger
select is((select count(*)::int from public.profiles where id in
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b')), 2,
  'auth.users insert creates profiles');
select is((select plan from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'free',
  'new profile is on free plan');

-- Anonymous visitor
set local role anon;
select is_empty('select 1 from public.raw_items', 'anon cannot read raw_items');
select throws_ok('select 1 from public.item_metrics', '42501', null, 'anon cannot read item_metrics');
select throws_ok('select 1 from public.story_clusters', '42501', null, 'anon cannot read story_clusters');
select throws_ok('select 1 from public.llm_usage', '42501', null, 'anon cannot read llm_usage');
select throws_ok('select 1 from public.pipeline_runs', '42501', null, 'anon cannot read pipeline_runs');
select results_eq('select title from public.stories', $$values ('Published'::text)$$,
  'anon sees only published stories');
select results_eq('select name from public.sources', $$values ('Test RSS'::text)$$,
  'anon can read source names');
select throws_ok('select etag from public.sources', '42501', null, 'anon cannot read source internals');
select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');

-- Authenticated user A
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.briefs where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  'A cannot see B''s briefs');
select is_empty($$select 1 from public.niches where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  'A cannot see B''s niches');
select is_empty($$update public.niches set name = 'hacked'
  where id = '30000000-0000-0000-0000-00000000000b' returning 1$$, 'A cannot update B''s niche');
select throws_ok($$update public.profiles set plan = 'pro'
  where id = '00000000-0000-0000-0000-00000000000a'$$, '42501', null, 'A cannot change own plan');
select throws_ok($$update public.profiles set is_admin = true
  where id = '00000000-0000-0000-0000-00000000000a'$$, '42501', null, 'A cannot make self admin');
select lives_ok($$update public.profiles set name = 'Ayşe'
  where id = '00000000-0000-0000-0000-00000000000a'$$, 'A can update own name');
select throws_ok($$insert into public.briefs (user_id, story_id, platform, format, tone)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', 'x', 'thread', 'plain')$$,
  '42501', null, 'briefs are created only server-side (usage limits)');
select throws_ok($$insert into public.niches (user_id, name)
  values ('00000000-0000-0000-0000-00000000000a', 'mine')$$,
  '42501', null, 'niches are created only server-side (plan limits)');

select * from finish();
rollback;
