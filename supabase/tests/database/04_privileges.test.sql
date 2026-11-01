begin;
select plan(4);

select ok(not has_function_privilege('authenticated', 'public.increment_usage(uuid, text, integer)', 'execute'),
  'authenticated cannot call increment_usage (limit must come from server)');
select ok(not has_function_privilege('anon', 'public.increment_usage(uuid, text, integer)', 'execute'),
  'anon cannot call increment_usage');
select ok(not has_function_privilege('authenticated', 'public.release_usage(uuid, text)', 'execute'),
  'authenticated cannot call release_usage');
select ok(not has_function_privilege('authenticated', 'public.match_story_cluster(vector, real, timestamptz)', 'execute'),
  'authenticated cannot call match_story_cluster');

select * from finish();
rollback;
