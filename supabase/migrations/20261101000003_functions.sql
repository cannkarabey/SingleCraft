-- Triggers and SQL functions (IMPLEMENTATION_PLAN §4). radar_feed() arrives with Faz 5.

-- New auth user → profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- briefs.updated_at maintenance.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger briefs_touch_updated_at
  before update on public.briefs
  for each row execute function public.touch_updated_at();

-- Atomic daily usage counter. Returns false (and does not count) once p_limit is reached;
-- a null limit means unlimited. The limit comes from server-side plan config, so only
-- the service role may call this.
create function public.increment_usage(p_user uuid, p_kind text, p_limit int)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_limit is not null and p_limit <= 0 then
    return false;
  end if;

  insert into public.usage_counters as u (user_id, day, kind, count)
  values (p_user, current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set count = u.count + 1
    where p_limit is null or u.count < p_limit
  returning u.count into v_count;

  return v_count is not null;
end;
$$;

-- Gives back one unit, e.g. when a Studio generation fails.
create function public.release_usage(p_user uuid, p_kind text)
returns void
language sql
set search_path = ''
as $$
  update public.usage_counters
     set count = greatest(count - 1, 0)
   where user_id = p_user and day = current_date and kind = p_kind;
$$;

-- Nearest story cluster for an item embedding, among clusters created since p_since.
create function public.match_story_cluster(
  p_embedding extensions.vector(768),
  p_threshold real,
  p_since timestamptz
)
returns table (story_id uuid, similarity real)
language sql
stable
set search_path = ''
as $$
  select c.story_id, (1 - (c.embedding operator(extensions.<=>) p_embedding))::real as similarity
    from public.story_clusters c
   where c.created_at >= p_since
     and 1 - (c.embedding operator(extensions.<=>) p_embedding) >= p_threshold
   order by c.embedding operator(extensions.<=>) p_embedding
   limit 1;
$$;

revoke execute on function public.increment_usage(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.release_usage(uuid, text) from public, anon, authenticated;
revoke execute on function public.match_story_cluster(extensions.vector, real, timestamptz)
  from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, int) to service_role;
grant execute on function public.release_usage(uuid, text) to service_role;
grant execute on function public.match_story_cluster(extensions.vector, real, timestamptz) to service_role;
