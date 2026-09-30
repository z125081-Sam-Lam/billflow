-- Billflow database setup.
-- Run this once in Supabase: left sidebar -> SQL Editor -> New query -> paste -> Run.
-- It creates one table that stores each user's workspace (clients + invoices + settings),
-- locked down so every user can only ever read or write their OWN row.

create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

drop policy if exists "own workspace select" on public.workspaces;
drop policy if exists "own workspace insert" on public.workspaces;
drop policy if exists "own workspace update" on public.workspaces;
drop policy if exists "own workspace delete" on public.workspaces;

create policy "own workspace select" on public.workspaces
  for select using (auth.uid() = user_id);
create policy "own workspace insert" on public.workspaces
  for insert with check (auth.uid() = user_id);
create policy "own workspace update" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workspace delete" on public.workspaces
  for delete using (auth.uid() = user_id);
