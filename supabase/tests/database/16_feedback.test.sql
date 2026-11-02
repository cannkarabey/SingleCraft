begin;
select plan(6);

select has_table('public', 'feedback', 'feedback table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.feedback'::regclass), 'RLS on');
select ok(not has_table_privilege('anon', 'public.feedback', 'select'), 'anon cannot read feedback');
select ok(not has_table_privilege('authenticated', 'public.feedback', 'insert'), 'users cannot insert directly');
select ok(not has_table_privilege('authenticated', 'public.feedback', 'select'), 'users cannot read feedback');

insert into auth.users (id, email) values ('fb000000-0000-0000-0000-000000000001', 'fb@test.dev');
select throws_ok(
  $$ insert into public.feedback (user_id, message) values ('fb000000-0000-0000-0000-000000000001', '') $$,
  '23514', null, 'empty message rejected');

select * from finish();
rollback;
