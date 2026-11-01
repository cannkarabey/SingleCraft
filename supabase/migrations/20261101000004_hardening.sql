-- Review fixes for 0002/0003.

-- 1) EXECUTE on new functions is granted to PUBLIC by Postgres' global default; a
--    per-schema `alter default privileges ... revoke` cannot remove that. Revoke it
--    globally for functions this role creates, so every client-callable RPC must be
--    granted explicitly.
alter default privileges revoke execute on functions from public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 2) Clients may only record their own save/hide/boost signals on published stories;
--    'generate' and 'published' are written by the server.
drop policy "own signals: insert" on public.user_signals;
create policy "own signals: insert" on public.user_signals
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and action in ('save', 'hide', 'boost')
    and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published')
  );
