-- Row level security and column privileges (IMPLEMENTATION_PLAN §4 RLS).
-- Supabase grants ALL on public tables to anon/authenticated by default; reset that
-- and grant explicitly so every client-reachable table and column is a deliberate choice.
-- Writes that enforce plan/usage limits (niches insert, briefs insert, usage counters)
-- go through server routes with the service role, never directly from the client.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','niches','sources','raw_items','item_metrics','stories','story_sources',
    'story_clusters','trend_scores','user_signals','user_story_angles','briefs',
    'brief_versions','subscriptions','usage_counters','llm_usage','pipeline_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Pipeline-internal tables: no client grants at all (service role only):
-- raw_items, item_metrics, story_clusters, llm_usage, pipeline_runs.
-- raw_items gets a select grant with no policy so anon/authenticated see zero rows
-- (the plan's "client access none"); the others stay ungranted entirely.
grant select on public.raw_items to anon, authenticated;

-- Public catalogue ------------------------------------------------------------
grant select (id, name, type, url, trust_weight, active) on public.sources to anon, authenticated;
create policy "sources are public" on public.sources for select to anon, authenticated using (true);

grant select on public.stories to anon, authenticated;
create policy "published stories are public" on public.stories
  for select to anon, authenticated using (status = 'published');

grant select on public.story_sources to anon, authenticated;
create policy "sources of published stories are public" on public.story_sources
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));

grant select on public.trend_scores to anon, authenticated;
create policy "scores of published stories are public" on public.trend_scores
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));

-- Per-user data ---------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (name, locale, timezone, digest_enabled, digest_hour, onboarded_at) on public.profiles to authenticated;
create policy "own profile: read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, delete on public.niches to authenticated;
grant update (name, keywords, excluded_keywords, platforms, tone, language, tracked_channels,
              voice_samples, alert_threshold) on public.niches to authenticated;
create policy "own niches: read" on public.niches
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own niches: update" on public.niches
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own niches: delete" on public.niches
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.user_signals to authenticated;
grant usage on sequence public.user_signals_id_seq to authenticated;
create policy "own signals: read" on public.user_signals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own signals: insert" on public.user_signals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own signals: delete" on public.user_signals
  for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.user_story_angles to authenticated;
create policy "own angles: read" on public.user_story_angles
  for select to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.briefs to authenticated;
grant update (edited, selected_hook, published_at, published_url) on public.briefs to authenticated;
create policy "own briefs: read" on public.briefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own briefs: update" on public.briefs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own briefs: delete" on public.briefs
  for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.brief_versions to authenticated;
create policy "own brief versions: read" on public.brief_versions
  for select to authenticated
  using (exists (select 1 from public.briefs b where b.id = brief_id and b.user_id = (select auth.uid())));

grant select on public.subscriptions to authenticated;
create policy "own subscriptions: read" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.usage_counters to authenticated;
create policy "own usage: read" on public.usage_counters
  for select to authenticated using (user_id = (select auth.uid()));
