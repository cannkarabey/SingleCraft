begin;
select plan(6);

select ok(not has_function_privilege('authenticated', 'public.increment_usage(uuid, text, integer)', 'execute'),
  'authenticated cannot call increment_usage (limit must come from server)');
select ok(not has_function_privilege('anon', 'public.increment_usage(uuid, text, integer)', 'execute'),
  'anon cannot call increment_usage');
select ok(not has_function_privilege('authenticated', 'public.release_usage(uuid, text)', 'execute'),
  'authenticated cannot call release_usage');
select ok(not has_function_privilege('authenticated', 'public.match_story_cluster(vector, real, timestamptz)', 'execute'),
  'authenticated cannot call match_story_cluster');

-- Functions created later must not be callable by clients unless explicitly granted.
create function public.zz_probe() returns int language sql as 'select 1';
select ok(not has_function_privilege('anon', 'public.zz_probe()', 'execute'),
  'new functions are not executable by anon by default');
select ok(not has_function_privilege('authenticated', 'public.zz_probe()', 'execute'),
  'new functions are not executable by authenticated by default');

select * from finish();
rollback;
