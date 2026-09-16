-- Makes the server-side booking rule match the public site.
-- "Старт" / force_open opens bookings early, but never after the close time
-- or after the training has started.

create or replace function public.booking_is_open(target public.sessions)
returns boolean language sql stable
as $$
  select not target.booking_closed
     and now() < ((target.date + target.time) at time zone 'Europe/Sofia')
     and now() < ((target.date + target.time) at time zone 'Europe/Sofia') - make_interval(secs => (target.booking_close_hours * 3600)::double precision)
     and (
       target.force_open
       or now() >= ((target.date + target.time) at time zone 'Europe/Sofia') - make_interval(days => target.booking_days)
     );
$$;

notify pgrst, 'reload schema';
