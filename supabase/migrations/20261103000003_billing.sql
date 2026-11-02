-- Faz 8: Lemon Squeezy subscriptions drive profiles.plan.

alter table public.subscriptions
  add column variant_id text,
  add column ends_at timestamptz,
  add column renews_at timestamptz,
  add column provider_updated_at timestamptz,
  add column created_at timestamptz not null default now();

-- Plan a user is entitled to at p_now: the best plan among subscriptions that are paid
-- (active / on_trial / past_due) or cancelled but still inside their paid period.
create function public.entitled_plan(p_user uuid, p_now timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select s.plan
      from public.subscriptions s
     where s.user_id = p_user
       and (s.status in ('active', 'on_trial', 'past_due')
            or (s.status = 'cancelled' and s.ends_at > p_now))
     order by case s.plan when 'pro' then 2 when 'creator' then 1 else 0 end desc
     limit 1), 'free');
$$;

-- Applies one provider subscription event and recomputes the user's plan. Events older
-- than the stored state are ignored (webhooks can arrive out of order or be replayed).
create function public.apply_subscription(
  p_user uuid,
  p_subscription_id text,
  p_customer_id text,
  p_variant_id text,
  p_plan text,
  p_status text,
  p_ends_at timestamptz,
  p_renews_at timestamptz,
  p_updated_at timestamptz,
  p_now timestamptz
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_plan text;
begin
  if p_plan not in ('creator', 'pro') then
    raise exception 'unknown plan: %', p_plan using errcode = '22023';
  end if;

  insert into public.subscriptions as s (
    user_id, provider, provider_customer_id, provider_subscription_id, variant_id, plan, status,
    ends_at, renews_at, current_period_end, provider_updated_at
  ) values (
    p_user, 'lemonsqueezy', p_customer_id, p_subscription_id, p_variant_id, p_plan, p_status,
    p_ends_at, p_renews_at, coalesce(p_ends_at, p_renews_at), p_updated_at
  )
  on conflict (provider_subscription_id) do update
    set provider_customer_id = excluded.provider_customer_id,
        variant_id = excluded.variant_id,
        plan = excluded.plan,
        status = excluded.status,
        ends_at = excluded.ends_at,
        renews_at = excluded.renews_at,
        current_period_end = excluded.current_period_end,
        provider_updated_at = excluded.provider_updated_at
    where s.provider_updated_at is null or excluded.provider_updated_at >= s.provider_updated_at;

  v_plan := public.entitled_plan(p_user, p_now);
  update public.profiles set plan = v_plan where id = p_user and plan is distinct from v_plan;
  return v_plan;
end;
$$;

-- Daily safety net: drop users whose cancelled period ended (in case a webhook was missed).
create function public.expire_subscriptions(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_changed int;
begin
  with targets as (
    select distinct s.user_id from public.subscriptions s
     where s.status = 'cancelled' and s.ends_at <= p_now
  ),
  updated as (
    update public.profiles p
       set plan = public.entitled_plan(p.id, p_now)
      from targets t
     where p.id = t.user_id and p.plan is distinct from public.entitled_plan(p.id, p_now)
    returning 1
  )
  select count(*)::int into v_changed from updated;
  return v_changed;
end;
$$;

revoke execute on function public.entitled_plan(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.expire_subscriptions(timestamptz) from public, anon, authenticated;
grant execute on function public.entitled_plan(uuid, timestamptz) to service_role;
grant execute on function public.apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  to service_role;
grant execute on function public.expire_subscriptions(timestamptz) to service_role;
