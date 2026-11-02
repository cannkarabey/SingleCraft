-- Faz 3: semantic clustering, duplicate attachment, metric windows for scoring, archiving.

-- Attach an accepted item to the nearest story cluster (cosine similarity >= p_threshold
-- among clusters created since p_since) or start a new pending story. Stores the item's
-- embedding and keeps the cluster centroid as the running mean of its members.
-- Idempotent: an item already linked to a story returns that story unchanged.
create function public.cluster_item(
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
begin
  select ss.story_id into v_story from public.story_sources ss where ss.raw_item_id = p_item_id;
  if v_story is not null then
    return query select v_story, false;
    return;
  end if;

  select r.source_id into strict v_source from public.raw_items r where r.id = p_item_id;
  update public.raw_items set embedding = p_embedding where id = p_item_id;

  select m.story_id into v_story
    from public.match_story_cluster(p_embedding, p_threshold, p_since) m;

  if v_story is null then
    insert into public.stories (status, source_count) values ('pending', 1) returning id into v_story;
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

-- Exact/near duplicates (Faz 2) join their root's story as additional sources.
create function public.attach_duplicates()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_attached int;
begin
  with linked as (
    insert into public.story_sources (story_id, raw_item_id, source_id)
    select root.story_id, d.id, d.source_id
      from public.raw_items d
      join public.story_sources root on root.raw_item_id = d.duplicate_of
     where d.filter_status = 'duplicate'
       and not exists (select 1 from public.story_sources x where x.raw_item_id = d.id)
    on conflict (raw_item_id) do nothing
    returning story_id
  ),
  counts as (select story_id, count(*) as n from linked group by story_id),
  bumped as (
    update public.stories s
       set source_count = s.source_count + c.n, last_updated_at = now()
      from counts c
     where s.id = c.story_id
    returning 1
  )
  select coalesce(sum(n), 0) into v_attached from counts;
  return v_attached;
end;
$$;

-- Per (story, item, metric) of live stories first seen since p_since: the newest value and
-- the baseline for velocity = last value at/before p_window_start, or the first value
-- inside the window when the item has no older snapshot (only observed growth counts).
create function public.story_metric_window(p_since timestamptz, p_window_start timestamptz)
returns table (
  story_id uuid,
  raw_item_id bigint,
  source_type public.source_type,
  metric text,
  latest int,
  baseline int
)
language sql
stable
set search_path = ''
as $$
  select ss.story_id, m.raw_item_id, src.type, m.metric,
         (array_agg(m.value order by m.captured_at desc))[1] as latest,
         coalesce(
           (array_agg(m.value order by m.captured_at desc) filter (where m.captured_at <= p_window_start))[1],
           (array_agg(m.value order by m.captured_at asc))[1]
         ) as baseline
    from public.stories s
    join public.story_sources ss on ss.story_id = s.id
    join public.sources src on src.id = ss.source_id
    join public.item_metrics m on m.raw_item_id = ss.raw_item_id
   where s.first_seen_at >= p_since
     and s.status in ('pending', 'published')
   group by ss.story_id, m.raw_item_id, src.type, m.metric;
$$;

-- Stories first seen before p_cutoff leave the feeds (plan §5.7: 7 days).
create function public.archive_stale_stories(p_cutoff timestamptz)
returns int
language sql
set search_path = ''
as $$
  with archived as (
    update public.stories
       set status = 'archived'
     where first_seen_at < p_cutoff
       and status in ('pending', 'published')
    returning 1
  )
  select count(*)::int from archived;
$$;

revoke execute on function public.cluster_item(bigint, extensions.vector, real, timestamptz) from public, anon, authenticated;
revoke execute on function public.attach_duplicates() from public, anon, authenticated;
revoke execute on function public.story_metric_window(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.archive_stale_stories(timestamptz) from public, anon, authenticated;
grant execute on function public.cluster_item(bigint, extensions.vector, real, timestamptz) to service_role;
grant execute on function public.attach_duplicates() to service_role;
grant execute on function public.story_metric_window(timestamptz, timestamptz) to service_role;
grant execute on function public.archive_stale_stories(timestamptz) to service_role;
