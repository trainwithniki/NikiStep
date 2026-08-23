-- Admin-only tariff corrections for people who registered through the public site.
create table if not exists public.registration_payment_overrides (
  registration_id text primary key references public.registrations(id) on delete cascade,
  payment_type text not null check (payment_type in ('multisport', 'individual', 'card8', 'card12')),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.registration_payment_overrides enable row level security;

revoke all on table public.registration_payment_overrides from anon, public;
grant select, insert, update, delete on table public.registration_payment_overrides to authenticated;

drop policy if exists "registration payment overrides admin only" on public.registration_payment_overrides;
create policy "registration payment overrides admin only" on public.registration_payment_overrides
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

do $$ begin
  alter publication supabase_realtime add table public.registration_payment_overrides;
exception when duplicate_object then null; end $$;
