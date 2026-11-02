-- Faz 7: daily digest and alert emails.

alter table public.profiles add column alerts_enabled boolean not null default true;
grant update (alerts_enabled) on public.profiles to authenticated;

-- Timezones drive the digest hour; an unknown name would break every digest query.
create function public.check_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone: %', new.timezone using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_timezone_valid
  before insert or update of timezone on public.profiles
  for each row execute function public.check_profile_timezone();
revoke execute on function public.check_profile_timezone() from public, anon, authenticated;

-- Sent (or being sent) emails. Rows are claimed before sending, which makes sending
-- idempotent: one digest per user and local day, one alert per user and story.
create table public.email_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('digest', 'alert')),
  story_id uuid references public.stories on delete cascade,
  day date not null,
  provider_id text,
  created_at timestamptz not null default now(),
  check ((kind = 'alert') = (story_id is not null))
);
create unique index email_log_digest_once on public.email_log (user_id, day) where kind = 'digest';
create unique index email_log_alert_once on public.email_log (user_id, story_id) where kind = 'alert';
create index email_log_user_day on public.email_log (user_id, kind, day);
alter table public.email_log enable row level security;

-- Users whose local hour is their digest hour and who have not had today's digest.
create function public.digest_due_users(p_now timestamptz)
returns table (user_id uuid, email text, locale text, timezone text, local_day date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.locale, p.timezone, (p_now at time zone p.timezone)::date
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.digest_enabled
     and u.email is not null
     and extract(hour from p_now at time zone p.timezone) = p.digest_hour
     and not exists (
       select 1 from public.email_log l
        where l.user_id = p.id and l.kind = 'digest'
          and l.day = (p_now at time zone p.timezone)::date);
$$;

revoke execute on function public.digest_due_users(timestamptz) from public, anon, authenticated;
grant execute on function public.digest_due_users(timestamptz) to service_role;
