-- Faz 6: the Studio editor listens for brief status changes (plan §1 #11). Realtime
-- respects RLS, so users only receive their own briefs.
alter publication supabase_realtime add table public.briefs;
