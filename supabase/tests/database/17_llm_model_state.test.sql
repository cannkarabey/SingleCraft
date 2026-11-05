begin;
select plan(4);
select has_table('public', 'llm_model_state', 'table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.llm_model_state'::regclass), 'RLS on');
select ok(not has_table_privilege('anon', 'public.llm_model_state', 'select'), 'anon cannot read');
select ok(not has_table_privilege('authenticated', 'public.llm_model_state', 'insert'), 'users cannot write');
select * from finish();
rollback;
