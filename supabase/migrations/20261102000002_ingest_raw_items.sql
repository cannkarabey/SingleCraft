-- Insert a fetched batch and map every item to its row id in one round trip.
-- Replaces a PostgREST `external_id=in.(...)` lookup that exceeded URL limits on large feeds.
create function public.ingest_raw_items(p_source_id uuid, p_items jsonb)
returns table (id bigint, external_id text, inserted boolean)
language sql
set search_path = ''
as $$
  with input as (
    select * from jsonb_populate_recordset(null::public.raw_items, p_items)
  ),
  ins as (
    insert into public.raw_items (
      source_id, external_id, url, canonical_url, title, description, content_text,
      author, published_at, language, content_hash, simhash, raw_metadata
    )
    select p_source_id, i.external_id, i.url, i.canonical_url, i.title, i.description,
           i.content_text, i.author, i.published_at, i.language, i.content_hash, i.simhash,
           coalesce(i.raw_metadata, '{}'::jsonb)
      from input i
    on conflict (source_id, external_id) do nothing
    returning raw_items.id, raw_items.external_id
  )
  select ins.id, ins.external_id, true from ins
  union all
  -- Rows that already existed (the CTE's inserts are not visible to this scan).
  select r.id, r.external_id, false
    from public.raw_items r
    join input i on i.external_id = r.external_id
   where r.source_id = p_source_id;
$$;

revoke execute on function public.ingest_raw_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_raw_items(uuid, jsonb) to service_role;
