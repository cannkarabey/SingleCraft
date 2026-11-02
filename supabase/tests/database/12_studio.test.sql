begin;
select plan(1);

-- Studio editor follows brief status through Supabase Realtime (plan §1 #11).
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'briefs'),
  'briefs is in the realtime publication');

select * from finish();
rollback;
