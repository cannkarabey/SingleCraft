begin;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.dev');

select ok(public.increment_usage('00000000-0000-0000-0000-00000000000a', 'brief', 2), '1st within limit');
select ok(public.increment_usage('00000000-0000-0000-0000-00000000000a', 'brief', 2), '2nd within limit');
select ok(not public.increment_usage('00000000-0000-0000-0000-00000000000a', 'brief', 2), '3rd over limit');
select is((select count from public.usage_counters
  where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'brief'), 2, 'counter stops at limit');
select ok(public.increment_usage('00000000-0000-0000-0000-00000000000a', 'brief', null), 'null limit = unlimited');
select lives_ok($$select public.release_usage('00000000-0000-0000-0000-00000000000a', 'brief')$$,
  'release_usage decrements');
select is((select count from public.usage_counters
  where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'brief'), 2, 'counter decremented');

-- match_story_cluster: identical vector matches, orthogonal does not
insert into public.stories (id) values ('20000000-0000-0000-0000-000000000001');
insert into public.story_clusters (story_id, embedding) values
  ('20000000-0000-0000-0000-000000000001', array_fill(0, array[767]) || array[1]::real[]);
select is((select story_id from public.match_story_cluster(
  (array_fill(0, array[767]) || array[1]::real[])::vector, 0.85, now() - interval '72 hours')),
  '20000000-0000-0000-0000-000000000001'::uuid, 'identical embedding matches its cluster');
select is_empty($$select 1 from public.match_story_cluster(
  (array[1]::real[] || array_fill(0, array[767]))::vector, 0.85, now() - interval '72 hours')$$,
  'orthogonal embedding matches nothing');

select * from finish();
rollback;
