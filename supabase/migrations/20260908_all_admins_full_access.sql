-- NikiStep: every active administrator has identical full Owner access.
-- Run once after 20260908_add_admin_audit_history.sql.

drop index if exists public.app_admins_single_owner_idx;

create or replace function public.enforce_full_admin_access()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.is_owner := true;
  new.can_view_history := true;
  return new;
end;
$$;
revoke all on function public.enforce_full_admin_access() from public, anon, authenticated;

drop trigger if exists enforce_full_admin_access on public.app_admins;
create trigger enforce_full_admin_access before insert or update on public.app_admins
for each row execute function public.enforce_full_admin_access();

update public.app_admins set is_owner=true,can_view_history=true;
notify pgrst, 'reload schema';
