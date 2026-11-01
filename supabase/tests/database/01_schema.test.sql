begin;
select plan(20);

select has_extension('vector');
select has_extension('pg_trgm');
select has_table('public', t, t || ' exists') from unnest(array[
  'profiles','niches','sources','raw_items','item_metrics','stories','story_sources',
  'story_clusters','trend_scores','user_signals','user_story_angles','briefs',
  'brief_versions','subscriptions','usage_counters','llm_usage','pipeline_runs'
]) as t;
select col_is_unique('raw_items', array['source_id','external_id'], 'raw_items dedupes on (source_id, external_id)');

select * from finish();
rollback;
