alter table public.registrations
add column if not exists has_multisport boolean not null default false;

notify pgrst, 'reload schema';
