-- Faz 2 ingestion: duplicate tracking, due-source selection, exact/near dedupe lookup.

alter table public.raw_items
  add column duplicate_of bigint references public.raw_items on delete set null;

alter table public.raw_items drop constraint raw_items_filter_status_check;
alter table public.raw_items
  add constraint raw_items_filter_status_check
  check (filter_status in ('pending', 'accepted', 'rejected', 'duplicate'));

create index on public.raw_items (filter_status, fetched_at desc);

-- Active sources whose fetch interval has elapsed (or that were never fetched).
create function public.due_sources()
returns setof public.sources
language sql
stable
set search_path = ''
as $$
  select *
    from public.sources s
   where s.active
     and (s.last_fetched_at is null
          or s.last_fetched_at + make_interval(mins => s.fetch_interval_min) <= now())
   order by s.last_fetched_at nulls first;
$$;

-- Earliest accepted item (other than p_item_id) that duplicates it:
-- 'exact' = same canonical_url or content_hash; 'near' = SimHash Hamming distance
-- <= p_max_distance among items fetched since p_since.
create function public.find_duplicate(p_item_id bigint, p_since timestamptz, p_max_distance int)
returns table (duplicate_of bigint, kind text)
language sql
stable
set search_path = ''
as $$
  with item as (
    select id, canonical_url, content_hash, simhash from public.raw_items where id = p_item_id
  ),
  exact as (
    select r.id
      from public.raw_items r, item i
     where r.id <> i.id
       and r.filter_status = 'accepted'
       and (r.canonical_url = i.canonical_url or r.content_hash = i.content_hash)
     order by r.id
     limit 1
  ),
  near as (
    select r.id
      from public.raw_items r, item i
     where r.id <> i.id
       and r.filter_status = 'accepted'
       and r.fetched_at >= p_since
       and r.simhash is not null and i.simhash is not null
       and bit_count((r.simhash # i.simhash)::bit(64)) <= p_max_distance
     order by bit_count((r.simhash # i.simhash)::bit(64)), r.id
     limit 1
  )
  select id, 'exact' from exact
  union all
  select id, 'near' from near where not exists (select 1 from exact)
  limit 1;
$$;

revoke execute on function public.due_sources() from public, anon, authenticated;
revoke execute on function public.find_duplicate(bigint, timestamptz, int) from public, anon, authenticated;
grant execute on function public.due_sources() to service_role;
grant execute on function public.find_duplicate(bigint, timestamptz, int) to service_role;
