begin;
select plan(7);

insert into auth.users (id, email) values ('f9000000-0000-0000-0000-00000000000a', 'r@test.dev');
insert into public.niches (id, user_id, name, keywords, excluded_keywords, tracked_channels) values
  ('f9100000-0000-0000-0000-00000000000a', 'f9000000-0000-0000-0000-00000000000a', 'AI in Rust', '{ai,rust}', '{go}', '{x}');
insert into public.sources (id, name, type, url) values
  ('f9200000-0000-0000-0000-000000000001', 'Nexus Daily', 'rss', 'https://nexus.test/feed');
insert into public.raw_items (id, source_id, external_id, url, canonical_url, title, content_hash, filter_status) values
  (490001, 'f9200000-0000-0000-0000-000000000001', 'n', 'https://nexus.test/1', 'https://nexus.test/1', 'x', 'q1', 'accepted');
insert into public.stories (id, status, title, summary, velocity_score, engagement_score, trust_score, first_seen_at) values
  ('f9300000-0000-0000-0000-000000000001', 'published', 'New AI compiler written in Rust', 'fast', 50, 10, 1, now()),
  ('f9300000-0000-0000-0000-000000000002', 'published', 'Officials said maintenance trusted', 'detail', 50, 10, 1, now()),
  ('f9300000-0000-0000-0000-000000000003', 'published', 'AI and Rust a week ago', 'google', 50, 10, 1, now()),
  ('f9300000-0000-0000-0000-000000000004', 'published', 'AI tooling in Rust', 'Go rewrite', 50, 10, 1, now());
insert into public.story_sources (story_id, raw_item_id, source_id) values
  ('f9300000-0000-0000-0000-000000000001', 490001, 'f9200000-0000-0000-0000-000000000001');

create temp table r as select * from public.radar_feed('f9100000-0000-0000-0000-00000000000a', 'f9000000-0000-0000-0000-00000000000a');

-- Review I3: keywords and exclusions match whole words, tracked channels match exactly.
select is((select niche_fit from r where story_id = 'f9300000-0000-0000-0000-000000000001'), 20::real,
  'whole-word keywords match; tracked "x" does not match "nexus"');
select ok(not exists(select 1 from r where story_id = 'f9300000-0000-0000-0000-000000000002'),
  '"ai" does not match inside "said"/"maintenance"; "rust" not inside "trusted"');
select ok(exists(select 1 from r where story_id = 'f9300000-0000-0000-0000-000000000003'),
  'excluded "go" does not match inside "ago"/"google"');
select ok(not exists(select 1 from r where story_id = 'f9300000-0000-0000-0000-000000000004'),
  'excluded "go" hides a story with the word "Go"');

-- Review I9: one signal per (user, story, action)
insert into public.user_signals (user_id, story_id, action) values
  ('f9000000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-000000000001', 'save');
select throws_ok($$insert into public.user_signals (user_id, story_id, action) values
  ('f9000000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-000000000001', 'save')$$, '23505', null,
  'duplicate signals are rejected');

-- Review I2: per-day reveal ledger, server-only
select has_table('public', 'radar_reveals', 'radar_reveals exists');
select ok(not has_table_privilege('authenticated', 'public.radar_reveals', 'select'), 'clients cannot read radar_reveals');

select * from finish();
rollback;
