begin;
select plan(13);

insert into auth.users (id, email) values
  ('e9000000-0000-0000-0000-00000000000a', 'digest-a@test.dev'),
  ('e9000000-0000-0000-0000-00000000000b', 'digest-b@test.dev'),
  ('e9000000-0000-0000-0000-00000000000c', 'digest-c@test.dev');
update public.profiles set digest_hour = 8, timezone = 'Europe/Istanbul' where id = 'e9000000-0000-0000-0000-00000000000a';
update public.profiles set digest_hour = 8, timezone = 'Europe/Istanbul', digest_enabled = false where id = 'e9000000-0000-0000-0000-00000000000b';
update public.profiles set digest_hour = 8, timezone = 'America/New_York' where id = 'e9000000-0000-0000-0000-00000000000c';

select is((select alerts_enabled from public.profiles where id = 'e9000000-0000-0000-0000-00000000000a'), true, 'alerts on by default');

-- 05:30 UTC = 08:30 Istanbul (UTC+3), 00:30 New York
select ok('e9000000-0000-0000-0000-00000000000a' in (select user_id from public.digest_due_users('2026-11-03 05:30+00')),
  'due at the local digest hour');
select is((select email from public.digest_due_users('2026-11-03 05:30+00') where user_id = 'e9000000-0000-0000-0000-00000000000a'),
  'digest-a@test.dev', 'returns the email');
select ok('e9000000-0000-0000-0000-00000000000a' not in (select user_id from public.digest_due_users('2026-11-03 06:30+00')),
  'not due an hour later');
select ok('e9000000-0000-0000-0000-00000000000b' not in (select user_id from public.digest_due_users('2026-11-03 05:30+00')),
  'disabled digest not due');
select ok('e9000000-0000-0000-0000-00000000000c' in (select user_id from public.digest_due_users('2026-11-03 13:10+00')),
  'other timezones use their own local hour');

insert into public.email_log (user_id, kind, day) values ('e9000000-0000-0000-0000-00000000000a', 'digest', '2026-11-03');
select ok('e9000000-0000-0000-0000-00000000000a' not in (select user_id from public.digest_due_users('2026-11-03 05:30+00')),
  'not due again the same local day');
select throws_ok($$insert into public.email_log (user_id, kind, day) values ('e9000000-0000-0000-0000-00000000000a', 'digest', '2026-11-03')$$,
  '23505', null, 'one digest per user and local day');

insert into public.stories (id, status, title) values ('e9100000-0000-0000-0000-000000000001', 'published', 'x');
insert into public.email_log (user_id, kind, story_id, day) values ('e9000000-0000-0000-0000-00000000000a', 'alert', 'e9100000-0000-0000-0000-000000000001', '2026-11-03');
select throws_ok($$insert into public.email_log (user_id, kind, story_id, day) values ('e9000000-0000-0000-0000-00000000000a', 'alert', 'e9100000-0000-0000-0000-000000000001', '2026-11-04')$$,
  '23505', null, 'one alert per user and story, ever');

select throws_ok($$update public.profiles set timezone = 'Mars/Olympus' where id = 'e9000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'invalid timezone rejected');

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.profiles set alerts_enabled = false, digest_hour = 9 where id = 'e9000000-0000-0000-0000-00000000000a'$$,
  'user can change their alert and digest settings');
reset role;

select ok(not has_function_privilege('authenticated', 'public.digest_due_users(timestamptz)', 'execute'), 'digest_due_users is server-only');
select ok(not has_table_privilege('authenticated', 'public.email_log', 'select'), 'email_log is server-only');

select * from finish();
rollback;
