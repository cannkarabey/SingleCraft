-- Model fallback state: which LLM models are cooling down or switched off, shared by every
-- serverless invocation. Written and read with the service role only.
create table public.llm_model_state (
  model text primary key,
  unavailable_until timestamptz not null,
  reason text not null,
  updated_at timestamptz not null default now()
);
alter table public.llm_model_state enable row level security;
revoke all on public.llm_model_state from anon, authenticated;
