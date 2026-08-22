-- Run once in Supabase > SQL Editor.
-- Stores one anonymous installation identifier per device. No names, phones,
-- IP addresses, or browser user-agent strings are saved.

create table if not exists public.app_installations (
  installation_id uuid primary key,
  platform text not null default 'android' check (platform = 'android'),
  installed_at timestamptz not null default now()
);

create index if not exists app_installations_installed_at_idx
  on public.app_installations (installed_at desc);

alter table public.app_installations enable row level security;

revoke all on table public.app_installations from anon, authenticated, public;
grant insert on table public.app_installations to anon, authenticated;
grant select on table public.app_installations to authenticated;

drop policy if exists "app installations public create" on public.app_installations;
create policy "app installations public create" on public.app_installations
for insert to anon, authenticated
with check (platform = 'android');

drop policy if exists "app installations admin read" on public.app_installations;
create policy "app installations admin read" on public.app_installations
for select to authenticated
using (public.is_app_admin());

do $$ begin
  alter publication supabase_realtime add table public.app_installations;
exception when duplicate_object then null; end $$;
