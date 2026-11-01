-- SignalCraft initial schema (IMPLEMENTATION_PLAN §4).
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.source_type    as enum ('rss','hn','reddit','github','producthunt','arxiv','youtube');
create type public.story_status   as enum ('pending','published','archived','suppressed');
create type public.story_category as enum ('ai_models','ai_tools','developer_tools','open_source','startups',
                                           'security','web_frontend','mobile','data_infra','other');
create type public.signal_action  as enum ('save','hide','boost','generate','published');
create type public.brief_status   as enum ('queued','generating','ready','failed');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  plan text not null default 'free' check (plan in ('free','creator','pro')),
  is_admin boolean not null default false,
  locale text not null default 'tr' check (locale in ('tr','en')),
  timezone text not null default 'Europe/Istanbul',
  digest_enabled boolean not null default true,
  digest_hour smallint not null default 8 check (digest_hour between 0 and 23),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.niches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  name text not null,
  keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  platforms text[] not null default '{}',
  tone text not null default 'analytical'
    check (tone in ('technical','analytical','fun','contrarian','plain')),
  language text not null default 'tr' check (language in ('tr','en')),
  tracked_channels text[] not null default '{}',
  voice_samples text[] not null default '{}' check (cardinality(voice_samples) <= 3),
  embedding extensions.vector(768),
  alert_threshold smallint not null default 85 check (alert_threshold between 0 and 100),
  created_at timestamptz not null default now()
);
create index on public.niches (user_id);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.source_type not null,
  url text not null unique,
  config jsonb not null default '{}',
  trust_weight numeric(3,2) not null default 0.7 check (trust_weight between 0 and 1),
  fetch_interval_min int not null default 30 check (fetch_interval_min > 0),
  active boolean not null default true,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  last_error text,
  consecutive_failures int not null default 0,
  created_at timestamptz not null default now()
);

create table public.raw_items (
  id bigserial primary key,
  source_id uuid not null references public.sources on delete cascade,
  external_id text not null,
  url text not null,
  canonical_url text not null,
  title text not null,
  description text,
  content_text text check (char_length(content_text) <= 4000),
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  language text,
  content_hash text not null,
  simhash bigint,
  embedding extensions.vector(768),
  filter_status text not null default 'pending' check (filter_status in ('pending','accepted','rejected')),
  reject_reason text,
  raw_metadata jsonb not null default '{}',
  unique (source_id, external_id)
);
create index on public.raw_items (canonical_url);
create index on public.raw_items (content_hash);
create index on public.raw_items (published_at desc);
create index on public.raw_items (fetched_at desc) where simhash is not null;

create table public.item_metrics (
  raw_item_id bigint not null references public.raw_items on delete cascade,
  metric text not null,
  value int not null,
  captured_at timestamptz not null default now(),
  primary key (raw_item_id, metric, captured_at)
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  summary text,
  why_it_matters text,
  category public.story_category,
  entities jsonb not null default '[]',
  sentiment text,
  creator_relevance smallint check (creator_relevance between 0 and 100),
  suggested_angles jsonb not null default '[]',
  velocity_score real not null default 0,
  engagement_score real not null default 0,
  source_diversity_score real not null default 0,
  freshness_score real not null default 0,
  trust_score real not null default 0,
  global_score real not null default 0,
  is_early_signal boolean not null default false,
  source_count int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  last_built_at timestamptz,
  built_source_count int not null default 0,
  status public.story_status not null default 'pending',
  search tsvector generated always as
    (to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(summary, ''))) stored
);
create index on public.stories using gin (search);
create index on public.stories (status, global_score desc);
create index on public.stories (status, first_seen_at desc);
create index on public.stories using gin (title extensions.gin_trgm_ops);

create table public.story_sources (
  id bigserial primary key,
  story_id uuid not null references public.stories on delete cascade,
  raw_item_id bigint not null unique references public.raw_items on delete cascade,
  source_id uuid not null references public.sources on delete cascade
);
create index on public.story_sources (story_id);

create table public.story_clusters (
  story_id uuid primary key references public.stories on delete cascade,
  embedding extensions.vector(768) not null,
  item_count int not null default 1,
  similarity_threshold real not null default 0.85,
  created_at timestamptz not null default now()
);
create index on public.story_clusters using hnsw (embedding extensions.vector_cosine_ops);

create table public.trend_scores (
  id bigserial primary key,
  story_id uuid not null references public.stories on delete cascade,
  metric text not null,
  value real not null,
  calculated_at timestamptz not null default now()
);
create index on public.trend_scores (story_id, calculated_at);

create table public.user_signals (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  story_id uuid not null references public.stories on delete cascade,
  action public.signal_action not null,
  created_at timestamptz not null default now()
);
create index on public.user_signals (user_id, story_id);

create table public.user_story_angles (
  user_id uuid not null references public.profiles on delete cascade,
  niche_id uuid not null references public.niches on delete cascade,
  story_id uuid not null references public.stories on delete cascade,
  angle text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, niche_id, story_id)
);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  story_id uuid not null references public.stories on delete cascade,
  niche_id uuid references public.niches on delete set null,
  platform text not null,
  format text not null,
  tone text not null,
  audience text,
  length text,
  user_take text,
  status public.brief_status not null default 'queued',
  output jsonb,
  edited jsonb,
  selected_hook int,
  model text,
  tokens_in int,
  tokens_out int,
  published_at timestamptz,
  published_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.briefs (user_id, created_at desc);

create table public.brief_versions (
  id bigserial primary key,
  brief_id uuid not null references public.briefs on delete cascade,
  output jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.brief_versions (brief_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  provider text not null check (provider in ('paddle','lemonsqueezy','stripe')),
  provider_customer_id text,
  provider_subscription_id text unique,
  plan text not null,
  status text not null,
  current_period_end timestamptz
);
create index on public.subscriptions (user_id);

create table public.usage_counters (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  kind text not null check (kind in ('brief','alert','personal_angle')),
  count int not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

create table public.llm_usage (
  id bigserial primary key,
  job text not null,
  model text not null,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,5),
  created_at timestamptz not null default now()
);
create index on public.llm_usage (created_at);

create table public.pipeline_runs (
  id bigserial primary key,
  fn text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb,
  error text
);
