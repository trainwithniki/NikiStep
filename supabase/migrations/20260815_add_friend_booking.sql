-- Stores who created a friend's registration. This value is visible only to admins.
alter table public.registrations
  add column if not exists booked_by text;
