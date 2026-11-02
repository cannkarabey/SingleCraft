begin;
select plan(15);

select has_column('raw_items', 'duplicate_of', 'raw_items.duplicate_of exists');

-- Sources: never fetched, overdue, fresh, inactive
insert into public.sources (id, name, type, url, fetch_interval_min, last_fetched_at, active) values
  ('a0000000-0000-0000-0000-000000000001', 'never',    'rss', 'https://t.test/never',   30, null,                        true),
  ('a0000000-0000-0000-0000-000000000002', 'overdue',  'rss', 'https://t.test/overdue', 30, now() - interval '31 minutes', true),
  ('a0000000-0000-0000-0000-000000000003', 'fresh',    'rss', 'https://t.test/fresh',   30, now() - interval '5 minutes',  true),
  ('a0000000-0000-0000-0000-000000000004', 'inactive', 'rss', 'https://t.test/inactive',30, null,                        false);

select ok('a0000000-0000-0000-0000-000000000001' in (select id from public.due_sources()), 'never-fetched source is due');
select ok('a0000000-0000-0000-0000-000000000002' in (select id from public.due_sources()), 'overdue source is due');
select ok('a0000000-0000-0000-0000-000000000003' not in (select id from public.due_sources()), 'fresh source is not due');
select ok('a0000000-0000-0000-0000-000000000004' not in (select id from public.due_sources()), 'inactive source is not due');

-- Items: accepted root, candidates
insert into public.raw_items (id, source_id, external_id, url, canonical_url, title, content_hash, simhash, filter_status) values
  (900001, 'a0000000-0000-0000-0000-000000000001', 'root', 'https://n.test/a', 'https://n.test/a', 'Root', 'hash-root', 0, 'accepted'),
  (900002, 'a0000000-0000-0000-0000-000000000001', 'rej',  'https://n.test/r', 'https://n.test/r', 'Rejected', 'hash-rej', 1023, 'rejected'),
  (900010, 'a0000000-0000-0000-0000-000000000002', 'same-url',  'https://n.test/a?x', 'https://n.test/a', 'Other title', 'hash-x', -1, 'pending'),
  (900011, 'a0000000-0000-0000-0000-000000000002', 'same-hash', 'https://n.test/b', 'https://n.test/b', 'Root', 'hash-root', -1, 'pending'),
  (900012, 'a0000000-0000-0000-0000-000000000002', 'near',      'https://n.test/c', 'https://n.test/c', 'Near', 'hash-near', 7, 'pending'),
  (900013, 'a0000000-0000-0000-0000-000000000002', 'far',       'https://n.test/d', 'https://n.test/d', 'Far', 'hash-far', 255, 'pending'),
  (900014, 'a0000000-0000-0000-0000-000000000002', 'only-rej',  'https://n.test/r', 'https://n.test/r', 'R2', 'hash-r2', -1, 'pending');

update public.raw_items set filter_status = 'duplicate', duplicate_of = 900001 where id = 900002;
select is((select filter_status from public.raw_items where id = 900002), 'duplicate', 'filter_status accepts duplicate');
update public.raw_items set filter_status = 'rejected', duplicate_of = null where id = 900002;

select results_eq($$select duplicate_of, kind from public.find_duplicate(900010, now() - interval '72 hours', 3)$$,
  $$values (900001::bigint, 'exact'::text)$$, 'same canonical url is an exact duplicate');
select results_eq($$select duplicate_of, kind from public.find_duplicate(900011, now() - interval '72 hours', 3)$$,
  $$values (900001::bigint, 'exact'::text)$$, 'same content hash is an exact duplicate');
select results_eq($$select duplicate_of, kind from public.find_duplicate(900012, now() - interval '72 hours', 3)$$,
  $$values (900001::bigint, 'near'::text)$$, 'simhash within distance 3 is a near duplicate');
select is_empty($$select 1 from public.find_duplicate(900013, now() - interval '72 hours', 3)$$,
  'simhash distance 8 is not a duplicate');
select is_empty($$select 1 from public.find_duplicate(900014, now() - interval '72 hours', 3)$$,
  'rejected items are not duplicate roots');
select is_empty($$select 1 from public.find_duplicate(900001, now() - interval '72 hours', 3)$$,
  'an item is not its own duplicate');

select ok(not has_function_privilege('anon', 'public.due_sources()', 'execute'), 'anon cannot call due_sources');
select ok(not has_function_privilege('authenticated', 'public.find_duplicate(bigint, timestamptz, integer)', 'execute'),
  'authenticated cannot call find_duplicate');
select ok(has_function_privilege('service_role', 'public.find_duplicate(bigint, timestamptz, integer)', 'execute'),
  'service role can call find_duplicate');

select * from finish();
rollback;
