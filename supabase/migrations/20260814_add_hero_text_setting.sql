-- Редактируем текст върху главната снимка.
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "site settings public read" on public.site_settings;
create policy "site settings public read"
  on public.site_settings for select to anon, authenticated using (true);

drop policy if exists "site settings admin write" on public.site_settings;
create policy "site settings admin write"
  on public.site_settings for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

insert into public.site_settings(key,value)
values ('hero_text',E'MOVE. SWEAT.\nFEEL GOOD.')
on conflict (key) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.site_settings;
exception when duplicate_object then null; end $$;
