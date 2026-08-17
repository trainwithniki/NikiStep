-- Admin-only payment statistics for completed training sessions.
-- Public/anonymous users receive no table privileges and no RLS policy.
create table if not exists public.payment_adjustments (
  session_id text primary key references public.sessions(id) on delete cascade,
  extra_individual integer not null default 0 check (extra_individual between 0 and 1000),
  extra_multisport integer not null default 0 check (extra_multisport between 0 and 1000),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_config (
  id text primary key check (id = 'default'),
  multisport_rate numeric(8,2) not null default 1.70 check (multisport_rate >= 0),
  individual_rate numeric(8,2) not null default 3.75 check (individual_rate >= 0),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.payment_adjustments enable row level security;
alter table public.payment_config enable row level security;
revoke all on table public.payment_adjustments from anon;
revoke all on table public.payment_config from anon;
grant select, insert, update, delete on table public.payment_adjustments to authenticated;
grant select, insert, update, delete on table public.payment_config to authenticated;

drop policy if exists "payment adjustments admin only" on public.payment_adjustments;
create policy "payment adjustments admin only" on public.payment_adjustments
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "payment config admin only" on public.payment_config;
create policy "payment config admin only" on public.payment_config
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

insert into public.payment_config(id,multisport_rate,individual_rate)
values ('default',1.70,3.75) on conflict (id) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.payment_adjustments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.payment_config;
exception when duplicate_object then null; end $$;
