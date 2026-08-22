-- Run once in Supabase > SQL Editor after 20260822_add_app_installations.sql.
-- Allows the same anonymous installation counter to distinguish Android and iOS.

alter table public.app_installations
  drop constraint if exists app_installations_platform_check;

alter table public.app_installations
  add constraint app_installations_platform_check
  check (platform in ('android', 'ios'));

drop policy if exists "app installations public create" on public.app_installations;
create policy "app installations public create" on public.app_installations
for insert to anon, authenticated
with check (platform in ('android', 'ios'));
