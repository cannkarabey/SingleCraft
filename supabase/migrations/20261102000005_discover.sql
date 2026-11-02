-- Faz 4: public read accessors for Discover. raw_items and item_metrics stay closed to
-- clients; these functions expose only what a story page shows, and only for published
-- stories (content_text is never returned: plan §1 #18).

create function public.discover_story_sources(p_story_id uuid)
returns table (
  raw_item_id bigint,
  title text,
  url text,
  published_at timestamptz,
  source_name text,
  source_type public.source_type
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.title, r.url, coalesce(r.published_at, r.fetched_at), src.name, src.type
    from public.stories s
    join public.story_sources ss on ss.story_id = s.id
    join public.raw_items r on r.id = ss.raw_item_id
    join public.sources src on src.id = ss.source_id
   where s.id = p_story_id
     and s.status = 'published'
   order by coalesce(r.published_at, r.fetched_at) desc, r.id desc
   limit 50;
$$;

-- Latest value per platform metric, maxed over a story's items.
create function public.discover_story_signals(p_story_ids uuid[])
returns table (
  story_id uuid,
  hn_points int,
  hn_comments int,
  reddit_upvotes int,
  github_stars int,
  producthunt_votes int
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (m.raw_item_id, m.metric)
           ss.story_id, src.type, m.metric, m.value
      from public.stories s
      join public.story_sources ss on ss.story_id = s.id
      join public.sources src on src.id = ss.source_id
      join public.item_metrics m on m.raw_item_id = ss.raw_item_id
     where s.id = any(p_story_ids)
       and s.status = 'published'
     order by m.raw_item_id, m.metric, m.captured_at desc
  )
  select story_id,
         max(value) filter (where type = 'hn' and metric = 'points'),
         max(value) filter (where type = 'hn' and metric = 'comments'),
         max(value) filter (where type = 'reddit' and metric = 'upvotes'),
         max(value) filter (where type = 'github' and metric = 'stars'),
         max(value) filter (where type = 'producthunt' and metric = 'votes')
    from latest
   group by story_id;
$$;

revoke execute on function public.discover_story_sources(uuid) from public;
revoke execute on function public.discover_story_signals(uuid[]) from public;
grant execute on function public.discover_story_sources(uuid) to anon, authenticated, service_role;
grant execute on function public.discover_story_signals(uuid[]) to anon, authenticated, service_role;
