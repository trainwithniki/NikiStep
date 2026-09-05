-- Public list requested by the owner: names only; no phones, tariffs or registration identifiers.
-- Does not change registration table RLS or expose cancelled registrations.
create or replace function public.public_registration_names(target_session_id text)
returns table (name text)
language sql stable security definer
set search_path = ''
as $$
  select r.name
  from public.registrations as r
  where r.session_id = target_session_id and r.cancelled_at is null
  order by r.created_at, r.id;
$$;

revoke all on function public.public_registration_names(text) from public;
grant execute on function public.public_registration_names(text) to anon, authenticated;
notify pgrst, 'reload schema';
