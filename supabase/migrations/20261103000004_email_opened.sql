-- Faz 9: digest open tracking (plan §10 "Digest açılma" ← Resend webhook).
-- First open only: the webhook sets this once, so repeated opens do not inflate the rate.
alter table public.email_log add column opened_at timestamptz;
create unique index email_log_provider_id on public.email_log (provider_id)
  where provider_id is not null;
