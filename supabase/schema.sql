-- Run this entire file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id text primary key,
  date date not null,
  time time not null,
  title text not null default 'Step Aerobics',
  trainer text not null default 'Niki',
  location text not null default 'Fit Body Center',
  duration integer not null default 60 check (duration between 10 and 300),
  capacity integer not null default 20 check (capacity between 1 and 200),
  booking_closed boolean not null default false,
  force_open boolean not null default false,
  booking_days integer not null default 2 check (booking_days between 1 and 4),
  booking_close_hours numeric not null default 0 check (booking_close_hours >= 0),
  announcement text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  phone text not null check (char_length(phone) between 7 and 24),
  has_multisport boolean not null default false,
  booked_by text,
  pending boolean not null default false,
  cancel_token uuid not null default gen_random_uuid(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_adjustments (
  session_id text primary key references public.sessions(id) on delete cascade,
  extra_individual integer not null default 0 check (extra_individual between 0 and 1000),
  extra_multisport integer not null default 0 check (extra_multisport between 0 and 1000),
  extra_card8 integer not null default 0 check (extra_card8 between 0 and 1000),
  extra_card12 integer not null default 0 check (extra_card12 between 0 and 1000),
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

create table if not exists public.manual_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  "time" time not null default '18:30',
  title text not null default 'Step Aerobics with Niki' check (char_length(trim(title)) between 2 and 120),
  location text not null check (char_length(trim(location)) between 2 and 120),
  template_id text,
  multisport_count integer not null default 0 check (multisport_count between 0 and 1000),
  individual_count integer not null default 0 check (individual_count between 0 and 1000),
  card8_count integer not null default 0 check (card8_count between 0 and 1000),
  card12_count integer not null default 0 check (card12_count between 0 and 1000),
  multisport_rate numeric(8,2) not null default 0 check (multisport_rate >= 0),
  individual_rate numeric(8,2) not null default 0 check (individual_rate >= 0),
  card8_rate numeric(8,2) check (card8_rate is null or card8_rate >= 0),
  card12_rate numeric(8,2) check (card12_rate is null or card12_rate >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_payment_sessions_date_idx
  on public.manual_payment_sessions (date desc);

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

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_installations (
  installation_id uuid primary key,
  platform text not null default 'android' check (platform = 'android'),
  installed_at timestamptz not null default now()
);

create index if not exists app_installations_installed_at_idx
  on public.app_installations (installed_at desc);

alter table public.sessions enable row level security;
alter table public.registrations enable row level security;
alter table public.payment_adjustments enable row level security;
alter table public.payment_config enable row level security;
alter table public.manual_payment_sessions enable row level security;
alter table public.manual_payment_templates enable row level security;
alter table public.app_admins enable row level security;
alter table public.site_settings enable row level security;
alter table public.app_installations enable row level security;

-- Safe migration for projects created with an earlier version of this file.
alter table public.registrations add column if not exists has_multisport boolean not null default false;
alter table public.registrations add column if not exists cancelled_at timestamptz;
create unique index if not exists registrations_one_active_phone_per_session
  on public.registrations (session_id, (regexp_replace(phone, '\D', '', 'g')))
  where cancelled_at is null;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.app_admins where user_id = auth.uid()) $$;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.booking_is_open(target public.sessions)
returns boolean language sql stable
as $$
  select now() >= ((target.date + target.time) at time zone 'Europe/Sofia') - make_interval(days => target.booking_days)
     and now() <  ((target.date + target.time) at time zone 'Europe/Sofia') - make_interval(secs => (target.booking_close_hours * 3600)::double precision)
     and not target.booking_closed;
$$;

drop policy if exists "sessions public read" on public.sessions;
create policy "sessions public read" on public.sessions for select to anon, authenticated using (true);
drop policy if exists "sessions admin write" on public.sessions;
create policy "sessions admin write" on public.sessions for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "site settings public read" on public.site_settings;
create policy "site settings public read" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "site settings admin write" on public.site_settings;
create policy "site settings admin write" on public.site_settings for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on table public.app_installations from anon, authenticated, public;
grant insert on table public.app_installations to anon, authenticated;
grant select on table public.app_installations to authenticated;
drop policy if exists "app installations public create" on public.app_installations;
create policy "app installations public create" on public.app_installations for insert to anon, authenticated with check (platform = 'android');
drop policy if exists "app installations admin read" on public.app_installations;
create policy "app installations admin read" on public.app_installations for select to authenticated using (public.is_app_admin());

insert into public.site_settings(key,value) values ('hero_text',E'MOVE. SWEAT.\nFEEL GOOD.') on conflict (key) do nothing;
insert into public.site_settings(key,value) values ('hero_subtitle','Енергична тренировка с музика, движение и настроение във Fit Body Center.') on conflict (key) do nothing;

drop policy if exists "registrations admin read" on public.registrations;
create policy "registrations admin read" on public.registrations for select to authenticated using (public.is_app_admin());
drop policy if exists "registrations public create" on public.registrations;
create policy "registrations public create" on public.registrations for insert to anon, authenticated
with check (exists(select 1 from public.sessions s where s.id = session_id and public.booking_is_open(s)));
drop policy if exists "registrations admin write" on public.registrations;
create policy "registrations admin write" on public.registrations for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on table public.payment_adjustments from anon;
grant select, insert, update, delete on table public.payment_adjustments to authenticated;
drop policy if exists "payment adjustments admin only" on public.payment_adjustments;
create policy "payment adjustments admin only" on public.payment_adjustments
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on table public.payment_config from anon;
grant select, insert, update, delete on table public.payment_config to authenticated;
drop policy if exists "payment config admin only" on public.payment_config;
create policy "payment config admin only" on public.payment_config
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
insert into public.payment_config(id,multisport_rate,individual_rate)
values ('default',1.70,3.75) on conflict (id) do nothing;

revoke all on table public.manual_payment_sessions from anon, public;
grant select, insert, update, delete on table public.manual_payment_sessions to authenticated;
drop policy if exists "manual payment sessions admin only" on public.manual_payment_sessions;
create policy "manual payment sessions admin only" on public.manual_payment_sessions
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on table public.manual_payment_templates from anon, public;
grant select, insert, update, delete on table public.manual_payment_templates to authenticated;
drop policy if exists "manual payment templates admin only" on public.manual_payment_templates;
create policy "manual payment templates admin only" on public.manual_payment_templates
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
insert into public.manual_payment_templates
  (id,name,title,location,"time",multisport_rate,individual_rate,card8_rate,card12_rate,sort_order)
values
  ('pilates-mon','Пилатес Понеделник','Пилатес Понеделник','Fitness Line','07:45',1.70,3.75,3.06,2.54,1),
  ('pilates-fri','Пилатес Петък','Пилатес Петък','Fitness Line','07:45',1.70,3.75,3.06,2.54,2),
  ('step-fl-mon','STEP FL Пон','STEP FL Пон','Fitness Line','18:30',1.33,2.73,null,null,3),
  ('step-fl-fri','STEP FL Пт','STEP FL Пт','Fitness Line','18:30',1.33,2.73,null,null,4)
on conflict (id) do nothing;

create or replace function public.public_sessions()
returns table (
  id text, date date, "time" time, title text, trainer text, location text,
  duration integer, capacity integer, booking_closed boolean, force_open boolean,
  booking_days integer, booking_close_hours numeric, announcement text,
  description text, registration_count bigint
)
language sql stable security definer set search_path = public
as $$
  select s.id,s.date,s.time,s.title,s.trainer,s.location,s.duration,s.capacity,
         s.booking_closed,s.force_open,s.booking_days,s.booking_close_hours,
         s.announcement,s.description,count(r.id) filter (where r.cancelled_at is null)
  from public.sessions s left join public.registrations r on r.session_id=s.id
  group by s.id;
$$;
grant execute on function public.public_sessions() to anon, authenticated;

create or replace function public.cancel_registration(registration_id text, token uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.registrations set cancelled_at = now()
  where id = registration_id and cancel_token = token and cancelled_at is null;
  return found;
end;
$$;
grant execute on function public.cancel_registration(text, uuid) to anon, authenticated;

insert into public.sessions (id,date,time,title,trainer,location,duration,capacity,booking_days,description)
values
('s-2026-08-20','2026-08-20','18:30','Step Aerobics','Niki','Fit Body Center',60,20,2,'Предстояща Step Aerobics тренировка във Fit Body Center.'),
('s-2026-08-27','2026-08-27','18:30','Step Aerobics','Niki','Fit Body Center',60,20,2,'Предстояща Step Aerobics тренировка във Fit Body Center.')
on conflict (id) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.registrations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.site_settings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.payment_adjustments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.payment_config;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.manual_payment_sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.manual_payment_templates;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.app_installations;
exception when duplicate_object then null; end $$;

-- After creating your Auth user, run this separately with your real email:
-- insert into public.app_admins(user_id)
-- select id from auth.users where email = 'your-email@example.com'
-- on conflict do nothing;
