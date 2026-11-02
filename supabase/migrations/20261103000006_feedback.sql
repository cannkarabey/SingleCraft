-- Faz 9 beta feedback widget. Written by POST /api/feedback with the service role after an
-- auth check and a daily limit; read only in /admin. No client grants.
create table public.feedback (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  page text check (char_length(page) <= 500),
  created_at timestamptz not null default now()
);
create index feedback_user_created on public.feedback (user_id, created_at desc);
create index feedback_created on public.feedback (created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
revoke all on sequence public.feedback_id_seq from anon, authenticated;
