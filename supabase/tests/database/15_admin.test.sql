begin;
select plan(7);

insert into public.sources (id, name, type, url, trust_weight)
values ('ad000000-0000-0000-0000-000000000001', 'admin test', 'rss', 'https://admin.test/feed', 0.8);
insert into public.raw_items (source_id, external_id, url, canonical_url, title, content_hash, filter_status, reject_reason, fetched_at)
values
  ('ad000000-0000-0000-0000-000000000001', 'a1', 'https://a/1', 'https://a/1', 't1', 'h1', 'rejected', 'spam', '2026-11-03 09:00+00'),
  ('ad000000-0000-0000-0000-000000000001', 'a2', 'https://a/2', 'https://a/2', 't2', 'h2', 'rejected', 'spam', '2026-11-03 09:30+00'),
  ('ad000000-0000-0000-0000-000000000001', 'a3', 'https://a/3', 'https://a/3', 't3', 'h3', 'rejected', 'stale', '2026-11-03 09:40+00'),
  ('ad000000-0000-0000-0000-000000000001', 'a4', 'https://a/4', 'https://a/4', 't4', 'h4', 'rejected', 'stale', '2026-10-01 09:00+00'),
  ('ad000000-0000-0000-0000-000000000001', 'a5', 'https://a/5', 'https://a/5', 't5', 'h5', 'accepted', null, '2026-11-03 09:00+00');

select results_eq(
  $$ select reason, count from public.admin_reject_reasons('2026-11-03 00:00+00')
      where reason in ('spam', 'stale') order by reason $$,
  $$ values ('spam'::text, 2::bigint), ('stale'::text, 1::bigint) $$,
  'reject reasons counted since the cutoff');

delete from public.llm_usage;
insert into public.llm_usage (job, model, cost_usd, created_at) values
  ('story', 'm', 0.10, '2026-11-03 08:00+00'),
  ('studio', 'm', 0.05, '2026-11-03 20:00+00'),
  ('story', 'm', 0.20, '2026-11-01 12:00+00'),
  ('story', 'm', 9.99, '2026-10-01 12:00+00');

select results_eq(
  $$ select day, cost_usd, calls from public.admin_llm_spend(14, '2026-11-03 22:00+00') $$,
  $$ values ('2026-11-01'::date, 0.20::numeric, 1::bigint), ('2026-11-03'::date, 0.15::numeric, 2::bigint) $$,
  'daily LLM spend for the last 14 days (UTC days)');

select ok(not has_function_privilege('anon', 'public.admin_reject_reasons(timestamptz)', 'execute'), 'anon cannot read reject reasons');
select ok(not has_function_privilege('authenticated', 'public.admin_reject_reasons(timestamptz)', 'execute'), 'users cannot read reject reasons');
select ok(not has_function_privilege('authenticated', 'public.admin_llm_spend(int, timestamptz)', 'execute'), 'users cannot read LLM spend');
select ok(has_function_privilege('service_role', 'public.admin_llm_spend(int, timestamptz)', 'execute'), 'service role can');
select ok(has_function_privilege('service_role', 'public.admin_reject_reasons(timestamptz)', 'execute'), 'service role can read reasons');

select * from finish();
rollback;
