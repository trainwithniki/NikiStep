-- Admin-only payment records for trainings that are not published in the platform.
create table if not exists public.manual_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  "time" time not null default '18:30',
  title text not null default 'Step Aerobics with Niki' check (char_length(trim(title)) between 2 and 120),
  location text not null check (char_length(trim(location)) between 2 and 120),
  multisport_count integer not null default 0 check (multisport_count between 0 and 1000),
  individual_count integer not null default 0 check (individual_count between 0 and 1000),
  multisport_rate numeric(8,2) not null default 0 check (multisport_rate >= 0),
  individual_rate numeric(8,2) not null default 0 check (individual_rate >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_payment_sessions_date_idx
  on public.manual_payment_sessions (date desc);

alter table public.manual_payment_sessions enable row level security;
revoke all on table public.manual_payment_sessions from anon, public;
grant select, insert, update, delete on table public.manual_payment_sessions to authenticated;

drop policy if exists "manual payment sessions admin only" on public.manual_payment_sessions;
create policy "manual payment sessions admin only" on public.manual_payment_sessions
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

do $$ begin
  alter publication supabase_realtime add table public.manual_payment_sessions;
exception when duplicate_object then null; end $$;
