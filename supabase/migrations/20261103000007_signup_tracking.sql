-- Faz 9: `signed_up` analytics event is sent once per user (denominator of the §10
-- onboarding and first-brief funnels). Written only by the service role.
alter table public.profiles add column signup_captured_at timestamptz;
