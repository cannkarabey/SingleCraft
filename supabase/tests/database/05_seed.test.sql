begin;
select plan(9);

select cmp_ok((select count(*)::int from public.sources), '>=', 30, 'seed has at least 30 sources');
select ok(exists(select 1 from public.sources where type = t), 'seed has a ' || t || ' source')
  from unnest(enum_range(null::public.source_type)) as t;
select is((select count(*)::int from (select url from public.sources group by url having count(*) > 1) d), 0,
  'source urls are unique');

select * from finish();
rollback;
