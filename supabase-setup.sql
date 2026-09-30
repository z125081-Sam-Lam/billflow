-- Billflow relational schema.
-- Run once in Supabase: SQL Editor -> New query -> paste all -> Run.
-- Three tables, each row owned by a user and locked so users only touch their own data.

-- CLIENTS -------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  email      text,
  address    text,
  created_at timestamptz not null default now()
);

-- INVOICES ------------------------------------------------------------
create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  num        text,
  client_id  uuid references public.clients(id) on delete set null,
  issued     date,
  due        date,
  status     text not null default 'draft',
  items      jsonb not null default '[]'::jsonb,
  tax_rate   numeric not null default 0,
  discount   numeric not null default 0,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists invoices_user_idx   on public.invoices(user_id);
create index if not exists invoices_client_idx on public.invoices(client_id);

-- SETTINGS (one row per user) ----------------------------------------
create table if not exists public.settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  company    jsonb not null default '{}'::jsonb,
  seq        int not null default 1,
  updated_at timestamptz not null default now()
);

-- ROW LEVEL SECURITY --------------------------------------------------
alter table public.clients  enable row level security;
alter table public.invoices enable row level security;
alter table public.settings enable row level security;

-- clients policies
drop policy if exists clients_sel on public.clients;
drop policy if exists clients_ins on public.clients;
drop policy if exists clients_upd on public.clients;
drop policy if exists clients_del on public.clients;
create policy clients_sel on public.clients for select using (auth.uid() = user_id);
create policy clients_ins on public.clients for insert with check (auth.uid() = user_id);
create policy clients_upd on public.clients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy clients_del on public.clients for delete using (auth.uid() = user_id);

-- invoices policies
drop policy if exists invoices_sel on public.invoices;
drop policy if exists invoices_ins on public.invoices;
drop policy if exists invoices_upd on public.invoices;
drop policy if exists invoices_del on public.invoices;
create policy invoices_sel on public.invoices for select using (auth.uid() = user_id);
create policy invoices_ins on public.invoices for insert with check (auth.uid() = user_id);
create policy invoices_upd on public.invoices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy invoices_del on public.invoices for delete using (auth.uid() = user_id);

-- settings policies
drop policy if exists settings_sel on public.settings;
drop policy if exists settings_ins on public.settings;
drop policy if exists settings_upd on public.settings;
drop policy if exists settings_del on public.settings;
create policy settings_sel on public.settings for select using (auth.uid() = user_id);
create policy settings_ins on public.settings for insert with check (auth.uid() = user_id);
create policy settings_upd on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy settings_del on public.settings for delete using (auth.uid() = user_id);

-- Optional: the old single-blob table is no longer used. To remove it:
-- drop table if exists public.workspaces;
