-- Run in Supabase SQL Editor. Authentication handled by Supabase Auth.
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;
create policy "Users read only own workspace" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert only own workspace" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update only own workspace" on public.workspaces
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete only own workspace" on public.workspaces
  for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.touch_workspace_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists touch_workspace_updated_at on public.workspaces;
create trigger touch_workspace_updated_at before update on public.workspaces
for each row execute function public.touch_workspace_updated_at();
