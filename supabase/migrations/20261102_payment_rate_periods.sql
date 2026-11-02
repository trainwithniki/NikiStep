-- Historical tariffs: seed from actual configured values, never overwrite an existing period.
create table if not exists public.payment_rate_periods (
  valid_from date primary key,
  multisport_rate numeric(8,2) not null check(multisport_rate >= 0),
  individual_rate numeric(8,2) not null check(individual_rate >= 0),
  card8_rate numeric(8,2) not null check(card8_rate >= 0),
  card12_rate numeric(8,2) not null check(card12_rate >= 0),
  updated_at timestamptz not null default now()
);
insert into public.payment_rate_periods(valid_from,multisport_rate,individual_rate,card8_rate,card12_rate)
select date '1900-01-01', coalesce((select multisport_rate from public.payment_config where id='default'),1.70),
  coalesce((select individual_rate from public.payment_config where id='default'),3.75), 3.06, 2.54
on conflict(valid_from) do nothing;
alter table public.payment_rate_periods enable row level security;
revoke all on public.payment_rate_periods from public, anon;
grant select, insert, update, delete on public.payment_rate_periods to authenticated;
drop policy if exists "payment rate periods admins" on public.payment_rate_periods;
create policy "payment rate periods admins" on public.payment_rate_periods for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
notify pgrst, 'reload schema';
