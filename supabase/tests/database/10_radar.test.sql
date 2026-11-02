begin;
select plan(17);

create function pg_temp.axis(k int) returns extensions.vector language sql as $$
  select (array_fill(0::real, array[k - 1]) || array[1::real] || array_fill(0::real, array[768 - k]))::extensions.vector
$$;

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-00000000000a', 'agents@test.dev'),
  ('f0000000-0000-0000-0000-00000000000b', 'web@test.dev');
insert into public.niches (id, user_id, name, keywords, excluded_keywords, tracked_channels, embedding) values
  ('f1000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000000a', 'AI agents',
   '{agents,LLM}', '{crypto}', '{Agent Weekly}', pg_temp.axis(1)),
  ('f1000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-00000000000b', 'Web frontend',
   '{react,css}', '{}', '{}', null);

insert into public.sources (id, name, type, url) values
  ('f2000000-0000-0000-0000-000000000001', 'Agent Weekly', 'rss', 'https://r.test/aw'),
  ('f2000000-0000-0000-0000-000000000002', 'Some Blog', 'rss', 'https://r.test/sb');
insert into public.raw_items (id, source_id, external_id, url, canonical_url, title, content_hash, filter_status) values
  (500001, 'f2000000-0000-0000-0000-000000000001', 'aw', 'https://r.test/1', 'https://r.test/1', 'x', 'r1', 'accepted');

-- s1: two keywords (agents, llm) → fit 20; high engagement, no editorial sources → gap
-- s2: web frontend only; s3: excluded keyword; s4: hidden; s5: keyword + tracked source;
-- s6: embedding match; s7: too old; s8: pending; s9: early signal
insert into public.stories (id, status, title, summary, velocity_score, engagement_score, source_diversity_score,
                            freshness_score, trust_score, is_early_signal, first_seen_at) values
  ('f3000000-0000-0000-0000-000000000001', 'published', 'New agents framework', 'Built for LLM tool use', 90, 80, 50, 100, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000002', 'published', 'React compiler ships', 'CSS and React news', 50, 20, 10, 90, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000003', 'published', 'Agents for crypto trading', 'LLM bots', 99, 99, 99, 99, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000004', 'published', 'Agents hidden story', 'LLM news', 60, 10, 10, 90, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000005', 'published', 'Weekly agents digest', 'roundup', 10, 10, 10, 50, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000006', 'published', 'Unrelated title', 'nothing matches', 100, 100, 100, 100, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000007', 'published', 'Old agents news', 'LLM', 90, 90, 90, 10, 1, false, now() - interval '4 days'),
  ('f3000000-0000-0000-0000-000000000008', 'pending',   'Pending agents', 'LLM', 90, 90, 90, 90, 1, false, now() - interval '2 hours'),
  ('f3000000-0000-0000-0000-000000000009', 'published', 'Early LLM signal', 'agents', 20, 10, 10, 90, 1, true, now() - interval '2 hours');
insert into public.story_sources (story_id, raw_item_id, source_id) values
  ('f3000000-0000-0000-0000-000000000005', 500001, 'f2000000-0000-0000-0000-000000000001');
insert into public.story_clusters (story_id, embedding) values
  ('f3000000-0000-0000-0000-000000000006', pg_temp.axis(1));
insert into public.user_signals (user_id, story_id, action) values
  ('f0000000-0000-0000-0000-00000000000a', 'f3000000-0000-0000-0000-000000000004', 'hide'),
  ('f0000000-0000-0000-0000-00000000000a', 'f3000000-0000-0000-0000-000000000001', 'save');

-- User A
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
create temp table a as select * from public.radar_feed('f1000000-0000-0000-0000-00000000000a');

select is((select niche_fit from a where story_id = 'f3000000-0000-0000-0000-000000000001'), 20::real, 'two keywords → fit 20');
select is((select final_score from a where story_id = 'f3000000-0000-0000-0000-000000000001'), 70.5::real, 'final_score formula');
select is((select bucket from a where story_id = 'f3000000-0000-0000-0000-000000000001'), 'gap', 'engaged but no editorial coverage → gap');
select is((select saved from a where story_id = 'f3000000-0000-0000-0000-000000000001'), true, 'saved flag');
select ok(not exists(select 1 from a where story_id = 'f3000000-0000-0000-0000-000000000002'), 'off-niche story not shown');
select ok(not exists(select 1 from a where story_id = 'f3000000-0000-0000-0000-000000000003'), 'excluded keyword hides the story');
select ok(not exists(select 1 from a where story_id = 'f3000000-0000-0000-0000-000000000004'), 'hidden story not shown');
select is((select niche_fit from a where story_id = 'f3000000-0000-0000-0000-000000000005'), 25::real, 'keyword + tracked channel → 25');
select is((select niche_fit from a where story_id = 'f3000000-0000-0000-0000-000000000006'), 100::real, 'embedding match → 100');
select is((select bucket from a where story_id = 'f3000000-0000-0000-0000-000000000006'), 'high', 'final ≥ 75 → high');
select ok(not exists(select 1 from a where story_id in ('f3000000-0000-0000-0000-000000000007', 'f3000000-0000-0000-0000-000000000008')),
  'old and unpublished stories not shown');
select is((select bucket from a where story_id = 'f3000000-0000-0000-0000-000000000009'), 'early', 'early signal bucket');
select throws_ok($$select * from public.radar_feed('f1000000-0000-0000-0000-00000000000b')$$, '42501', null,
  'cannot read another user''s niche');

-- User B
reset role;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
create temp table b as select * from public.radar_feed('f1000000-0000-0000-0000-00000000000b');
select is((select niche_fit from b where story_id = 'f3000000-0000-0000-0000-000000000002'), 20::real, 'web niche sees React story');
select ok(not exists(select 1 from b where story_id = 'f3000000-0000-0000-0000-000000000001'), 'web niche does not see agents story');

reset role;
select ok(not has_function_privilege('anon', 'public.radar_feed(uuid)', 'execute'), 'anon cannot call radar_feed');
select ok(has_function_privilege('authenticated', 'public.radar_feed(uuid)', 'execute'), 'authenticated can call radar_feed');

select * from finish();
rollback;
