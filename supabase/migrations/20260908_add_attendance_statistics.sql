-- Persistent name matching decisions for the administrator-only Statistics section.

create table if not exists public.statistics_name_aliases (
  alias_key text primary key check (char_length(alias_key) between 1 and 160),
  alias_name text not null check (char_length(trim(alias_name)) between 1 and 120),
  canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 120),
  canonical_key text check (canonical_key is null or char_length(canonical_key) between 1 and 160),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

-- Safe to run again if an earlier version of this migration was executed.
-- This makes a merge apply to one concrete person, rather than every matching name.
alter table public.statistics_name_aliases add column if not exists canonical_key text;

create table if not exists public.statistics_ignored_pairs (
  pair_key text primary key check (char_length(pair_key) between 3 and 330),
  first_name text not null check (char_length(trim(first_name)) between 1 and 120),
  second_name text not null check (char_length(trim(second_name)) between 1 and 120),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.statistics_name_aliases enable row level security;
alter table public.statistics_ignored_pairs enable row level security;
revoke all on table public.statistics_name_aliases from public,anon;
revoke all on table public.statistics_ignored_pairs from public,anon;
grant select,insert,update,delete on table public.statistics_name_aliases to authenticated;
grant select,insert,update,delete on table public.statistics_ignored_pairs to authenticated;

drop policy if exists "statistics aliases admin only" on public.statistics_name_aliases;
create policy "statistics aliases admin only" on public.statistics_name_aliases
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "statistics ignored pairs admin only" on public.statistics_ignored_pairs;
create policy "statistics ignored pairs admin only" on public.statistics_ignored_pairs
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.record_statistics_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  actor public.app_admins%rowtype;
  auth_email text;
  old_data jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  item_data jsonb;
  changes jsonb := '{}'::jsonb;
  field_name text;
  allowed text[];
begin
  if auth.uid() is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  select * into actor from public.app_admins where user_id=auth.uid() and active;
  if not found then if tg_op='DELETE' then return old; else return new; end if; end if;
  select email into auth_email from auth.users where id=auth.uid();
  allowed := case tg_table_name
    when 'statistics_name_aliases' then array['alias_name','canonical_name']
    when 'statistics_ignored_pairs' then array['first_name','second_name']
    else null end;
  if allowed is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  foreach field_name in array allowed loop
    if tg_op='INSERT' then changes:=changes||jsonb_build_object(field_name,jsonb_build_object('from',null,'to',new_data->field_name));
    elsif tg_op='DELETE' then changes:=changes||jsonb_build_object(field_name,jsonb_build_object('from',old_data->field_name,'to',null));
    elsif (old_data->field_name) is distinct from (new_data->field_name) then changes:=changes||jsonb_build_object(field_name,jsonb_build_object('from',old_data->field_name,'to',new_data->field_name));
    end if;
  end loop;
  if tg_op='UPDATE' and changes='{}'::jsonb then return new; end if;
  item_data:=case when tg_op='DELETE' then old_data else new_data end;
  insert into public.audit_logs(actor_id,actor_email,actor_name,actor_color,action,entity_type,entity_id,details)
  values(actor.user_id,coalesce(nullif(actor.email,''),auth_email,'unknown'),actor.display_name,actor.audit_color,tg_op,tg_table_name,
    -- The internal matching keys can contain a phone-based identity.  Audit logs
    -- deliberately store only an irreversible identifier and the safe name label.
    case when tg_table_name='statistics_name_aliases' then md5(coalesce(item_data->>'alias_key','')) else md5(coalesce(item_data->>'pair_key','')) end,
    jsonb_build_object('label',case when tg_table_name='statistics_name_aliases' then coalesce(item_data->>'alias_name','Име')||' → '||coalesce(item_data->>'canonical_name','Име') else coalesce(item_data->>'first_name','Име')||' / '||coalesce(item_data->>'second_name','Име') end,'date',null,'time',null,'changes',changes));
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.record_statistics_audit() from public,anon,authenticated;

drop trigger if exists statistics_aliases_audit on public.statistics_name_aliases;
create trigger statistics_aliases_audit after insert or update or delete on public.statistics_name_aliases
for each row execute function public.record_statistics_audit();
drop trigger if exists statistics_ignored_audit on public.statistics_ignored_pairs;
create trigger statistics_ignored_audit after insert or update or delete on public.statistics_ignored_pairs
for each row execute function public.record_statistics_audit();

notify pgrst,'reload schema';
