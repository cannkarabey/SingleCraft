-- Faz 9 admin panel (plan §8.2): aggregates for filter calibration and LLM spend.
-- Service role only; the admin routes check profiles.is_admin before calling them.

create function public.admin_reject_reasons(p_since timestamptz)
returns table (reason text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(r.reject_reason, 'unknown'), count(*)
    from public.raw_items r
   where r.filter_status = 'rejected'
     and r.fetched_at >= p_since
   group by 1
   order by 2 desc, 1;
$$;

create function public.admin_llm_spend(p_days int, p_now timestamptz)
returns table (day date, cost_usd numeric, calls bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (u.created_at at time zone 'utc')::date, coalesce(sum(u.cost_usd), 0), count(*)
    from public.llm_usage u
   where u.created_at > p_now - make_interval(days => p_days)
     and u.created_at <= p_now
   group by 1
   order by 1;
$$;

revoke execute on function public.admin_reject_reasons(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_llm_spend(int, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_reject_reasons(timestamptz) to service_role;
grant execute on function public.admin_llm_spend(int, timestamptz) to service_role;
