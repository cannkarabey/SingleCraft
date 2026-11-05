-- The app is free: no plans, subscriptions or Radar reveal budget.
drop function if exists public.apply_subscription;
drop function if exists public.expire_subscriptions;
drop function if exists public.entitled_plan;
drop table if exists public.subscriptions;
drop table if exists public.radar_reveals;
alter table public.profiles drop column if exists plan;
