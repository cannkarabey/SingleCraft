begin;
select plan(11);

insert into auth.users (id, email) values
  ('ea000000-0000-0000-0000-00000000000a', 'pay-a@test.dev'),
  ('ea000000-0000-0000-0000-00000000000b', 'pay-b@test.dev');

-- apply_subscription(user, sub id, customer, variant, plan, status, ends_at, renews_at, provider updated_at, now)
select is(public.apply_subscription('ea000000-0000-0000-0000-00000000000a', 'sub_1', 'cus_1', 'var_creator', 'creator', 'active',
  null, '2026-12-03', '2026-11-03 10:00+00', '2026-11-03 10:00+00'), 'creator', 'active subscription → creator');
select is((select plan from public.profiles where id = 'ea000000-0000-0000-0000-00000000000a'), 'creator', 'profile plan updated');

select is(public.apply_subscription('ea000000-0000-0000-0000-00000000000a', 'sub_1', 'cus_1', 'var_creator', 'creator', 'expired',
  '2026-11-01', null, '2026-11-03 09:00+00', '2026-11-03 10:05+00'), 'creator', 'an older event is ignored');

select is(public.apply_subscription('ea000000-0000-0000-0000-00000000000a', 'sub_1', 'cus_1', 'var_creator', 'creator', 'cancelled',
  '2026-12-03', null, '2026-11-03 11:00+00', '2026-11-03 11:00+00'), 'creator', 'cancelled keeps access until ends_at');
select is((select status from public.subscriptions where provider_subscription_id = 'sub_1'), 'cancelled', 'status stored');

select is(public.expire_subscriptions('2026-11-20 00:00+00'), 0, 'nothing to expire before ends_at');
select is(public.expire_subscriptions('2026-12-04 00:00+00'), 1, 'expires after ends_at');
select is((select plan from public.profiles where id = 'ea000000-0000-0000-0000-00000000000a'), 'free', 'back to free after the period');

-- best of several subscriptions wins
select public.apply_subscription('ea000000-0000-0000-0000-00000000000b', 'sub_old', 'cus_b', 'var_creator', 'creator', 'expired',
  '2026-10-01', null, '2026-10-01 00:00+00', '2026-11-03 10:00+00');
select is(public.apply_subscription('ea000000-0000-0000-0000-00000000000b', 'sub_new', 'cus_b', 'var_pro', 'pro', 'on_trial',
  null, '2026-11-17', '2026-11-03 10:00+00', '2026-11-03 10:00+00'), 'pro', 'trial counts as paid');

select throws_ok($$select public.apply_subscription('ea000000-0000-0000-0000-00000000000b', 'sub_x', 'cus_b', 'v', 'gold', 'active', null, null, now(), now())$$,
  '22023', null, 'unknown plan rejected');
select ok(not has_function_privilege('authenticated', 'public.apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz)', 'execute'),
  'only the server applies subscriptions');

select * from finish();
rollback;
