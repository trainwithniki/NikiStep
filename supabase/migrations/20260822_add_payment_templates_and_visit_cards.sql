-- Admin-only templates and visit-card payment types for external trainings.
alter table public.manual_payment_sessions
  add column if not exists template_id text,
  add column if not exists card8_count integer not null default 0 check (card8_count between 0 and 1000),
  add column if not exists card12_count integer not null default 0 check (card12_count between 0 and 1000),
  add column if not exists card8_rate numeric(8,2) check (card8_rate is null or card8_rate >= 0),
  add column if not exists card12_rate numeric(8,2) check (card12_rate is null or card12_rate >= 0);

create table if not exists public.manual_payment_templates (
  id text primary key,
  name text not null check (char_length(trim(name)) between 2 and 60),
  title text not null check (char_length(trim(title)) between 2 and 120),
  location text not null check (char_length(trim(location)) between 2 and 120),
  "time" time not null,
  multisport_rate numeric(8,2) not null check (multisport_rate >= 0),
  individual_rate numeric(8,2) not null check (individual_rate >= 0),
  card8_rate numeric(8,2) check (card8_rate is null or card8_rate >= 0),
  card12_rate numeric(8,2) check (card12_rate is null or card12_rate >= 0),
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.manual_payment_templates enable row level security;
revoke all on table public.manual_payment_templates from anon, public;
grant select, insert, update, delete on table public.manual_payment_templates to authenticated;

drop policy if exists "manual payment templates admin only" on public.manual_payment_templates;
create policy "manual payment templates admin only" on public.manual_payment_templates
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

insert into public.manual_payment_templates
  (id,name,title,location,"time",multisport_rate,individual_rate,card8_rate,card12_rate,sort_order)
values
  ('pilates-mon','Пилатес Пон','Пилатес Пон','Fitness Line','07:45',1.70,3.75,3.06,2.54,1),
  ('pilates-fri','Пилатес Пт','Пилатес Пт','Fitness Line','07:45',1.70,3.75,3.06,2.54,2),
  ('step-fl-mon','STEP FL Пон','STEP FL Пон','Fitness Line','18:30',1.33,2.73,null,null,3),
  ('step-fl-fri','STEP FL Пт','STEP FL Пт','Fitness Line','18:30',1.33,2.73,null,null,4)
on conflict (id) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.manual_payment_templates;
exception when duplicate_object then null; end $$;
