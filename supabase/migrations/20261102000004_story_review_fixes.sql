-- Review fixes for Faz 3.

-- I4: story age comes from its seed item, not from clustering time.
create or replace function public.cluster_item(
  p_item_id bigint,
  p_embedding extensions.vector(768),
  p_threshold real,
  p_since timestamptz
)
returns table (story_id uuid, created boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_source uuid;
  v_story uuid;
  v_count int;
  v_seen timestamptz;
begin
  select ss.story_id into v_story from public.story_sources ss where ss.raw_item_id = p_item_id;
  if v_story is not null then
    return query select v_story, false;
    return;
  end if;

  -- A story is as old as its earliest report, not as the moment we clustered it
  -- (backfills and newly added feeds bring days-old items).
  select r.source_id, least(now(), coalesce(r.published_at, r.fetched_at))
    into strict v_source, v_seen
    from public.raw_items r where r.id = p_item_id;
  update public.raw_items set embedding = p_embedding where id = p_item_id;

  select m.story_id into v_story
    from public.match_story_cluster(p_embedding, p_threshold, p_since) m;

  if v_story is null then
    insert into public.stories (status, source_count, first_seen_at)
    values ('pending', 1, v_seen) returning id into v_story;
    insert into public.story_clusters (story_id, embedding, item_count) values (v_story, p_embedding, 1);
    insert into public.story_sources (story_id, raw_item_id, source_id) values (v_story, p_item_id, v_source);
    return query select v_story, true;
    return;
  end if;

  select c.item_count into v_count from public.story_clusters c where c.story_id = v_story for update;
  update public.story_clusters c
     set embedding = (
           select array_agg((old_v * v_count + new_v) / (v_count + 1) order by i)::extensions.vector(768)
             from unnest(c.embedding::real[], p_embedding::real[]) with ordinality as t(old_v, new_v, i)
         ),
         item_count = v_count + 1
   where c.story_id = v_story;
  insert into public.story_sources (story_id, raw_item_id, source_id) values (v_story, p_item_id, v_source);
  update public.stories s
     set source_count = s.source_count + 1, last_updated_at = now()
   where s.id = v_story;
  return query select v_story, false;
end;
$$;


-- I2: builds that keep failing stop being retried (see buildStories).
alter table public.stories add column build_failures int not null default 0;

-- I6: one round trip for a whole scoring run.
create function public.apply_story_scores(p_scores jsonb)
returns int
language sql
set search_path = ''
as $$
  with updated as (
    update public.stories s
       set velocity_score = v.velocity_score,
           engagement_score = v.engagement_score,
           source_diversity_score = v.source_diversity_score,
           freshness_score = v.freshness_score,
           trust_score = v.trust_score,
           global_score = v.global_score,
           is_early_signal = v.is_early_signal
      from jsonb_to_recordset(p_scores) as v(
             id uuid, velocity_score real, engagement_score real, source_diversity_score real,
             freshness_score real, trust_score real, global_score real, is_early_signal boolean)
     where s.id = v.id
    returning 1
  )
  select count(*)::int from updated;
$$;

-- I6: trend_scores retention (sparklines need days, not months).
create function public.prune_trend_scores(p_before timestamptz)
returns int
language sql
set search_path = ''
as $$
  with deleted as (delete from public.trend_scores where calculated_at < p_before returning 1)
  select count(*)::int from deleted;
$$;

revoke execute on function public.apply_story_scores(jsonb) from public, anon, authenticated;
revoke execute on function public.prune_trend_scores(timestamptz) from public, anon, authenticated;
grant execute on function public.apply_story_scores(jsonb) to service_role;
grant execute on function public.prune_trend_scores(timestamptz) to service_role;
