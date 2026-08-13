-- Позволява отписване от същия браузър и пази историята за администратора.
alter table public.registrations
  add column if not exists cancelled_at timestamptz;

-- Един телефон може да има само едно активно записване за дадена тренировка.
-- След отписване същият човек може отново да се запише.
create unique index if not exists registrations_one_active_phone_per_session
  on public.registrations (session_id, (regexp_replace(phone, '\D', '', 'g')))
  where cancelled_at is null;

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
  update public.registrations
     set cancelled_at = now()
   where id = registration_id
     and cancel_token = token
     and cancelled_at is null;
  return found;
end;
$$;
grant execute on function public.cancel_registration(text, uuid) to anon, authenticated;
