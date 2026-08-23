-- Synchronize the admin quick-training templates between devices.
-- Run this entire file once in Supabase > SQL Editor.

create table if not exists public.training_templates (
  id text primary key check (char_length(id) between 1 and 80),
  name text not null check (char_length(trim(name)) between 1 and 80),
  title text not null check (char_length(trim(title)) between 1 and 120),
  trainer text not null check (char_length(trim(trainer)) between 1 and 80),
  location text not null check (char_length(trim(location)) between 1 and 120),
  "time" time not null default '18:30',
  duration integer not null default 60 check (duration between 10 and 300),
  capacity integer not null default 20 check (capacity between 1 and 200),
  booking_days integer not null default 2 check (booking_days between 1 and 4),
  booking_close_hours numeric not null default 0 check (booking_close_hours between 0 and 168),
  description text not null default '' check (char_length(description) <= 1200),
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.training_templates enable row level security;
revoke all on table public.training_templates from anon, public;
grant select, insert, update, delete on table public.training_templates to authenticated;

drop policy if exists "training templates admin only" on public.training_templates;
create policy "training templates admin only" on public.training_templates
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

do $$ begin
  alter publication supabase_realtime add table public.training_templates;
exception when duplicate_object then null; end $$;
