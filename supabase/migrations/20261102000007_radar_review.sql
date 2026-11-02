-- Review fixes for Faz 5 radar (C1, I2, I3, I9).

-- I3: whole-word matching. Boundaries are "not a letter/digit/underscore" so terms such as
-- "c++" or ".net" work too, and every regex metacharacter in the term is escaped.
create function public.word_pattern(p_term text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '(^|[^[:alnum:]_])'
      || regexp_replace(lower(trim(p_term)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
      || '($|[^[:alnum:]_])';
$$;

-- Host of a URL without "www.", for exact tracked-channel matches.
create function public.url_host(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(substring(p_url from '^[a-zA-Z]+://([^/:?#]+)')), '^www\.', '');
$$;

-- C1: radar_feed returns unlocked rows, so only the server (service role) may call it,
-- passing the user id it verified; the Free lock is applied by the caller.
drop function public.radar_feed(uuid);

create function public.radar_feed(p_niche uuid, p_user uuid)
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
  v_user uuid := p_user;
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
        where length(trim(k)) > 0 and c.text ~ public.word_pattern(k))
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
              where length(trim(k)) > 0 and v.text ~ public.word_pattern(k))) as keyword_fit,
           case when exists (
             select 1
               from public.story_sources ss
               join public.sources src on src.id = ss.source_id
               join unnest(v_niche.tracked_channels) t on length(trim(t)) > 0
                and (lower(src.name) = lower(trim(t))
                     or public.url_host(src.url) = regexp_replace(lower(trim(t)), '^www\.', ''))
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

revoke execute on function public.radar_feed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.radar_feed(uuid, uuid) to service_role;
revoke execute on function public.word_pattern(text) from public, anon, authenticated;
revoke execute on function public.url_host(text) from public, anon, authenticated;
grant execute on function public.word_pattern(text) to service_role;
grant execute on function public.url_host(text) to service_role;

-- I9: one signal per user, story and action.
delete from public.user_signals a
 using public.user_signals b
 where a.user_id = b.user_id and a.story_id = b.story_id and a.action = b.action and a.id > b.id;
alter table public.user_signals
  add constraint user_signals_unique unique (user_id, story_id, action);

-- I2: which Radar rows a user has opened today. The daily allowance counts reveals, so
-- hiding opened rows does not open new ones the same day.
create table public.radar_reveals (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  story_id uuid not null references public.stories on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, day, story_id)
);
alter table public.radar_reveals enable row level security;
