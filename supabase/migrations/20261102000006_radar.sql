-- Faz 5: personalised Radar feed (plan §5.5 NicheFit + final_score, §5.6 buckets).
-- SECURITY DEFINER because cluster embeddings and story sources are not client-readable;
-- the caller may only read their own niche.

create function public.radar_feed(p_niche uuid)
returns table (
  story_id uuid,
  slug text,
  title text,
  summary text,
  why_it_matters text,
  category public.story_category,
  source_count int,
  first_seen_at timestamptz,
  global_score real,
  velocity_score real,
  engagement_score real,
  trust_score real,
  is_early_signal boolean,
  niche_fit real,
  final_score real,
  bucket text,
  saved boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_niche public.niches;
begin
  select * into v_niche from public.niches n where n.id = p_niche and n.user_id = v_user;
  if not found then
    raise exception 'niche not found' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select s.*, lower(coalesce(s.title, '') || ' ' || coalesce(s.summary, '')) as text
      from public.stories s
     where s.status = 'published'
       and s.first_seen_at >= now() - interval '72 hours'
       and not exists (
         select 1 from public.user_signals us
          where us.user_id = v_user and us.story_id = s.id and us.action = 'hide')
  ),
  visible as (
    select c.* from candidates c
     where not exists (
       select 1 from unnest(v_niche.excluded_keywords) k
        where length(trim(k)) > 0 and position(lower(trim(k)) in c.text) > 0)
  ),
  fit as (
    select v.*,
           -- Embedding similarity mapped [0.5, 0.85] → [0, 100]; 0 when either side has none.
           coalesce((
             select greatest(0, least(1, ((1 - (sc.embedding operator(extensions.<=>) v_niche.embedding)) - 0.5) / 0.35)) * 100
               from public.story_clusters sc
              where sc.story_id = v.id and v_niche.embedding is not null
           ), 0) as embed_fit,
           least(30, 10 * (
             select count(distinct lower(trim(k)))
               from unnest(v_niche.keywords) k
              where length(trim(k)) > 0 and position(lower(trim(k)) in v.text) > 0)) as keyword_fit,
           case when exists (
             select 1
               from public.story_sources ss
               join public.sources src on src.id = ss.source_id
               join unnest(v_niche.tracked_channels) t on length(trim(t)) > 0
                and (position(lower(trim(t)) in lower(src.name)) > 0
                     or position(lower(trim(t)) in lower(src.url)) > 0)
              where ss.story_id = v.id) then 15 else 0 end as tracked_fit,
           (select count(*) from public.story_sources ss
              join public.sources src on src.id = ss.source_id
             where ss.story_id = v.id and src.type = 'rss') as editorial_sources
      from visible v
  ),
  scored as (
    select f.*,
           least(100, f.embed_fit + f.keyword_fit + f.tracked_fit)::real as nf
      from fit f
  ),
  ranked as (
    select sc.*,
           ((0.35 * sc.velocity_score + 0.25 * sc.engagement_score + 0.20 * sc.nf
             + 0.10 * sc.source_diversity_score + 0.10 * sc.freshness_score)
            * (0.7 + 0.3 * sc.trust_score))::real as fs
      from scored sc
     where sc.nf >= 20
  )
  select r.id, r.slug, r.title, r.summary, r.why_it_matters, r.category, r.source_count,
         r.first_seen_at, r.global_score, r.velocity_score, r.engagement_score, r.trust_score,
         r.is_early_signal, r.nf, r.fs,
         case
           when r.fs >= 75 then 'high'
           when r.is_early_signal then 'early'
           when r.engagement_score >= 60 and r.editorial_sources <= 1 then 'gap'
           else 'normal'
         end,
         exists (select 1 from public.user_signals us
                  where us.user_id = v_user and us.story_id = r.id and us.action = 'save')
    from ranked r
   order by r.fs desc, r.id;
end;
$$;

revoke execute on function public.radar_feed(uuid) from public, anon;
grant execute on function public.radar_feed(uuid) to authenticated, service_role;
